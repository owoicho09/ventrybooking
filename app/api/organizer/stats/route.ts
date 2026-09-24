import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { feeRateOf, organizerFundsFigures } from '@/lib/server/settlements';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();

  try {
    const [ticketsRes, orgRes] = await Promise.all([
      db.from('tickets').select('quantity').eq('organizer_id', user.sub).in('status', ['valid', 'used']),
      db.from('users').select('platform_fee_rate').eq('id', user.sub).maybeSingle(),
    ]);

    const ticketsSold = (ticketsRes.data || []).reduce((s, t) => s + t.quantity, 0);
    // Money figures are always the organiser's net (after Ventry's fee) —
    // never gross ticket revenue.
    const { settled, pending } = await organizerFundsFigures(db, user.sub, feeRateOf({ platform_fee_rate: orgRes.data?.platform_fee_rate ?? null }));

    return NextResponse.json(
      { success: true, data: { ticketsSold, fundsSettled: settled, fundsPending: pending } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('GET /api/organizer/stats error', err);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
