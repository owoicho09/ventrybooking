import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  eligibilityBlockers, feeRateOf, lagosDate, loadHolidays, loadUnsettled, nextWorkingDay,
  releaseCutoff, summarizePending, type OrganizerRow, type SettlementRow,
} from '@/lib/server/settlements';

/** Payout-section overview: every organiser with unsettled money, plus settlements needing attention. */
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = getServerSupabase();
    const holidays = await loadHolidays(db);
    const today  = lagosDate();
    const cutoff = releaseCutoff(today, holidays);

    const [unsettled, attentionRes] = await Promise.all([
      loadUnsettled(db),
      db.from('settlements')
        .select('*')
        .in('status', ['failed', 'processing', 'otp_pending'])
        .order('released_at', { ascending: false })
        .limit(100),
    ]);
    if (attentionRes.error) throw new Error(attentionRes.error.message);
    // A failed legacy escrow payout already had its sales returned to the
    // daily pool, so there is nothing to act on for it here.
    const attention = ((attentionRes.data ?? []) as SettlementRow[])
      .filter(s => !(s.kind === 'legacy_escrow' && s.status === 'failed'));

    const ids = Array.from(new Set([...unsettled.keys(), ...attention.map(s => s.organizer_id)]));
    let orgRows: OrganizerRow[] = [];
    if (ids.length > 0) {
      const { data, error } = await db.from('users')
        .select('id, name, email, bank_name, account_number, account_name, platform_fee_rate')
        .in('id', ids);
      if (error) throw new Error(error.message);
      orgRows = (data ?? []) as OrganizerRow[];
    }
    const orgs = new Map(orgRows.map(o => [o.id, o]));

    const organizers = Array.from(unsettled.entries())
      .filter(([id]) => orgs.has(id))
      .map(([id, u]) => {
        const org = orgs.get(id)!;
        const summary = summarizePending(u.days, u.owed, feeRateOf(org), cutoff, holidays);
        const blockers = summary.releasable
          ? eligibilityBlockers({ organizer: org, releasableNet: summary.releasable.net })
          : [];
        return {
          id, name: org.name, email: org.email,
          bankName: org.bank_name, accountNumber: org.account_number, accountName: org.account_name,
          feeRate: feeRateOf(org),
          ...summary,
          blockers,
        };
      })
      .sort((a, b) => (b.releasable?.net ?? -Infinity) - (a.releasable?.net ?? -Infinity));

    return NextResponse.json(
      {
        success: true,
        data: {
          today,
          cutoff,
          todayIsWorkingDay: cutoff === today,
          nextWorkingDay: nextWorkingDay(today, holidays),
          organizers,
          attention: attention.map(s => ({ ...s, organizer_name: orgs.get(s.organizer_id)?.name ?? '—' })),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('GET /api/admin/settlements error', err);
    return NextResponse.json({ error: 'Failed to load settlements' }, { status: 500 });
  }
}
