import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  feeRateOf, lagosDate, loadHolidays, loadUnsettled, organizerFundsFigures, releaseCutoff, summarizePending,
} from '@/lib/server/settlements';

/**
 * The organiser's settlement history. Amounts are only ever the organiser's
 * net (after Ventry's fee) — gross and fee are deliberately not returned.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServerSupabase();
    const { data: org } = await db.from('users').select('platform_fee_rate').eq('id', user.sub).maybeSingle();
    const feeRate = feeRateOf({ platform_fee_rate: org?.platform_fee_rate ?? null });

    const [holidays, unsettled, settlementsRes, figures] = await Promise.all([
      loadHolidays(db),
      loadUnsettled(db, user.sub),
      db.from('settlements')
        .select('id, kind, period_start, period_end, net, ticket_count, status, released_at, settled_at, event_name')
        .eq('organizer_id', user.sub)
        .neq('status', 'void')
        .order('released_at', { ascending: false }),
      organizerFundsFigures(db, user.sub, feeRate),
    ]);
    if (settlementsRes.error) throw new Error(settlementsRes.error.message);

    const u = unsettled.get(user.sub);
    const pending = summarizePending(u?.days ?? [], u?.owed ?? null, feeRate, releaseCutoff(lagosDate(), holidays), holidays);

    return NextResponse.json(
      {
        success: true,
        data: {
          feeRate,
          fundsSettled: figures.settled,
          fundsPending: figures.pending,
          upcoming: [
            ...(pending.releasable
              ? [{ label: 'Ready for release', periodStart: pending.releasable.periodStart, periodEnd: pending.releasable.periodEnd, net: pending.releasable.net, eligibleOn: null as string | null }]
              : []),
            ...pending.accruing.map(a => ({ label: 'Releasable', periodStart: a.periodStart, periodEnd: a.periodEnd, net: a.net, eligibleOn: a.eligibleOn as string | null })),
          ],
          settlements: settlementsRes.data ?? [],
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('GET /api/organizer/payouts error', err);
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }
}
