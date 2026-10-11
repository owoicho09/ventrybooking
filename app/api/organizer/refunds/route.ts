import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * The organiser's refund cases. While a claim window is open only the
 * running totals are shown — buyers' details and bank accounts are released
 * as one complete list when it closes (Refund Policy §6.5), so nobody is
 * paid ahead of anybody else.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getServerSupabase();

  const { data: cases, error } = await db.from('refund_cases')
    .select('id, kind, status, refundable, opened_at, claims_close_at, cancel_days, list_sent_at, pay_by, paid_reported_at, overdue_flagged_at, reason, event_id, events!inner(event_name, date)')
    .eq('organizer_id', user.sub).eq('refundable', true)
    .order('opened_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (cases ?? []).map(c => c.id);
  const { data: claims } = ids.length
    ? await db.from('refund_claims')
      .select('case_id, ticket_id, refund_code, buyer_name, amount, status, claimed_at, bank_name, account_number, account_name')
      .in('case_id', ids)
    : { data: [] as never[] };

  const data = (cases ?? []).map(c => {
    const ev = (Array.isArray(c.events) ? c.events[0] : c.events) as { event_name: string; date: string };
    const mine = (claims ?? []).filter(r => r.case_id === c.id);
    const claimed = mine.filter(r => r.status === 'claimed' || r.status === 'paid');
    const listReleased = c.status === 'list_sent' || c.status === 'paid_reported';
    return {
      id: c.id, kind: c.kind, status: c.status, eventName: ev.event_name, eventDate: ev.date, reason: c.reason,
      openedAt: c.opened_at, claimsCloseAt: c.claims_close_at, cancelDays: c.cancel_days,
      listSentAt: c.list_sent_at, payBy: c.pay_by, paidReportedAt: c.paid_reported_at, overdue: !!c.overdue_flagged_at && !c.paid_reported_at,
      claimedCount: claimed.length,
      claimedTotal: claimed.reduce((s, r) => s + Number(r.amount), 0),
      ventryRefunded: mine.filter(r => r.status === 'auto_refunded' && Number(r.amount) > 0).map(r => ({ ticketId: r.ticket_id, amount: Number(r.amount) })),
      claims: listReleased
        ? claimed.map(r => ({
          ticketId: r.ticket_id, refundCode: r.refund_code, buyerName: r.buyer_name, amount: Number(r.amount), status: r.status,
          bankName: r.bank_name, accountNumber: r.account_number, accountName: r.account_name,
        }))
        : [],
    };
  });
  return NextResponse.json({ success: true, data });
}
