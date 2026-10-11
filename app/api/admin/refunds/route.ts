import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { decideNoShow, markHeldRefundDone, retryHeldRefund } from '@/lib/server/refundCases';

export const maxDuration = 60;

// Admin view of every refund case (Refund Policy §6–§9, Organiser Terms §11).

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getServerSupabase();

  const { data: cases, error } = await db.from('refund_cases')
    .select('id, kind, status, opened_at, claims_close_at, cancel_days, list_sent_at, pay_by, paid_reported_at, payment_proof_url, organizer_note, overdue_flagged_at, reason, decision_note, organizer_id, event_id, events!inner(event_name, date)')
    .eq('refundable', true)
    .order('opened_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (cases ?? []).map(c => c.id);
  const orgIds = [...new Set((cases ?? []).map(c => c.organizer_id))];
  const [{ data: claims }, { data: orgs }] = await Promise.all([
    ids.length
      ? db.from('refund_claims').select('id, case_id, ticket_id, refund_code, buyer_name, buyer_email, amount, status, claimed_at, statement, auto_refund_error, account_name, bank_name, account_number').in('case_id', ids)
      : Promise.resolve({ data: [] as never[] }),
    orgIds.length
      ? db.from('users').select('id, name, email, settlement_hold, settlement_hold_reason').in('id', orgIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const orgById = new Map((orgs ?? []).map(o => [o.id, o]));

  const data = (cases ?? []).map(c => {
    const ev = (Array.isArray(c.events) ? c.events[0] : c.events) as { event_name: string; date: string };
    const mine = (claims ?? []).filter(r => r.case_id === c.id);
    const sum = (rows: typeof mine) => rows.reduce((s, r) => s + Number(r.amount), 0);
    const claimed = mine.filter(r => r.status === 'claimed' || r.status === 'paid');
    const org = orgById.get(c.organizer_id);
    return {
      id: c.id, kind: c.kind, status: c.status, eventId: c.event_id, eventName: ev.event_name, eventDate: ev.date, reason: c.reason,
      openedAt: c.opened_at, claimsCloseAt: c.claims_close_at, listSentAt: c.list_sent_at, payBy: c.pay_by,
      paidReportedAt: c.paid_reported_at, proofUrl: c.payment_proof_url, organizerNote: c.organizer_note, decisionNote: c.decision_note,
      overdue: !!c.overdue_flagged_at && !c.paid_reported_at,
      organizer: org ? { id: org.id, name: org.name, email: org.email, hold: !!org.settlement_hold, holdReason: org.settlement_hold_reason } : null,
      counts: {
        tickets: mine.length,
        unclaimed: mine.filter(r => r.status === 'unclaimed').length,
        claimed: claimed.length, claimedTotal: sum(claimed),
        autoRefunded: mine.filter(r => r.status === 'auto_refunded' && Number(r.amount) > 0).length,
        autoRefundedTotal: sum(mine.filter(r => r.status === 'auto_refunded')),
      },
      failedAutoRefunds: mine.filter(r => r.status === 'auto_refund_failed').map(r => ({ id: r.id, ticketId: r.ticket_id, email: r.buyer_email, amount: Number(r.amount), error: r.auto_refund_error })),
      claims: claimed.map(r => ({ ticketId: r.ticket_id, refundCode: r.refund_code, buyerName: r.buyer_name, buyerEmail: r.buyer_email, amount: Number(r.amount), status: r.status, claimedAt: r.claimed_at, statement: r.statement, payTo: `${r.account_name ?? ''} · ${r.bank_name ?? ''} ${r.account_number ?? ''}` })),
    };
  });
  return NextResponse.json({ success: true, data });
}

/**
 * Actions:
 *   { action: 'decide', caseId, upheld, note }   no-show verdict
 *   { action: 'retry', claimId }                  retry a failed held-funds refund
 *   { action: 'mark_refunded', claimId }          held-funds refund done by hand
 *   { action: 'hold', organizerId, hold, reason } pause / resume an organiser's settlements
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getServerSupabase();
  const body = await req.json().catch(() => ({})) as { action?: string; caseId?: string; claimId?: string; organizerId?: string; upheld?: boolean; hold?: boolean; note?: string; reason?: string };

  try {
    switch (body.action) {
      case 'decide':
        if (!body.caseId || typeof body.upheld !== 'boolean') break;
        await decideNoShow(db, body.caseId, { upheld: body.upheld, note: body.note?.slice(0, 1000) ?? null, adminId: user.sub });
        return NextResponse.json({ success: true });
      case 'retry': {
        if (!body.claimId) break;
        const r = await retryHeldRefund(db, body.claimId, user.email);
        return NextResponse.json(r.ok ? { success: true } : { error: 'Paystack refused the refund again. Check the Paystack dashboard, refund by hand, then mark it refunded.' }, { status: r.ok ? 200 : 400 });
      }
      case 'mark_refunded':
        if (!body.claimId) break;
        await markHeldRefundDone(db, body.claimId, user.email);
        return NextResponse.json({ success: true });
      case 'hold': {
        if (!body.organizerId || typeof body.hold !== 'boolean') break;
        const reason = body.hold ? (body.reason?.trim().slice(0, 300) || 'Refunds overdue') : null;
        await db.from('users').update({ settlement_hold: body.hold, settlement_hold_reason: reason }).eq('id', body.organizerId);
        return NextResponse.json({ success: true });
      }
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 400 });
  }
}
