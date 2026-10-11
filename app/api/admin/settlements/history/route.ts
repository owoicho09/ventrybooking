import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { feeRateOf, loadHolidays, ORGANIZER_COLUMNS, type OrganizerRow } from '@/lib/server/settlements';
import { eventPayoutBreakdown, type EventPayoutSummary } from '@/lib/server/eventPayouts';

/**
 * Admin transaction history: every event that has had money paid out or still
 * owed, each with its own payout lines (one per settlement that carried its
 * tickets — an event paid by several daily settlements shows each of them).
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = getServerSupabase();

    // Organisers with any settlement or any paid ticket — everyone else has
    // nothing to show here.
    const [settledRes, ticketedRes, holidays] = await Promise.all([
      db.from('settlements').select('organizer_id').neq('status', 'void'),
      db.from('tickets').select('organizer_id').gt('total_paid', 0),
      loadHolidays(db),
    ]);
    if (settledRes.error) throw new Error(settledRes.error.message);
    if (ticketedRes.error) throw new Error(ticketedRes.error.message);
    const ids = Array.from(new Set([
      ...(settledRes.data ?? []).map(r => r.organizer_id as string),
      ...(ticketedRes.data ?? []).map(r => r.organizer_id as string),
    ].filter(Boolean)));
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: { events: [], totals: { paidOut: 0, pending: 0, payouts: 0 } } });
    }

    const { data: orgData, error: orgErr } = await db.from('users').select(ORGANIZER_COLUMNS).in('id', ids);
    if (orgErr) throw new Error(orgErr.message);
    const orgs = (orgData ?? []) as unknown as OrganizerRow[];

    const perOrg = await Promise.all(orgs.map(async org => {
      const events = await eventPayoutBreakdown(db, org.id, feeRateOf(org), holidays);
      return events
        .filter(e => e.payouts.length > 0 || e.pending > 0)
        .map(e => ({ ...e, organizerId: org.id, organizerName: org.name }));
    }));

    const events: (EventPayoutSummary & { organizerId: string; organizerName: string })[] = perOrg.flat()
      // Most recent activity first: latest payout, else the event date.
      .sort((a, b) => (b.payouts[0]?.date ?? b.date).localeCompare(a.payouts[0]?.date ?? a.date));

    const totals = {
      paidOut: events.reduce((s, e) => s + e.paidOut, 0),
      pending: events.reduce((s, e) => s + e.pending, 0),
      payouts: new Set(events.flatMap(e => e.payouts.map(p => p.settlementId))).size,
    };

    return NextResponse.json({ success: true, data: { events, totals } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/admin/settlements/history error', err);
    return NextResponse.json({ error: 'Failed to load payout history' }, { status: 500 });
  }
}
