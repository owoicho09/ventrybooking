import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();

  const { data: tickets } = await db
    .from('tickets')
    .select('quantity, total_paid, status')
    .eq('organizer_id', user.sub)
    .in('status', ['valid', 'used']);

  const { data: events } = await db
    .from('events')
    .select('id, status')
    .eq('organizer_id', user.sub);

  const { data: payouts } = await db
    .from('payouts')
    .select('net, status')
    .eq('organizer_id', user.sub)
    .eq('status', 'pending');

  const ticketsSold = tickets?.reduce((s, t) => s + t.quantity, 0) || 0;
  const revenueInEscrow = tickets?.reduce((s, t) => s + t.total_paid, 0) || 0;
  const activeEvents = events?.filter((e) => e.status === 'approved').length || 0;
  const payoutDue = payouts?.reduce((s, p) => s + p.net, 0) || 0;

  return NextResponse.json({
    success: true,
    data: { ticketsSold, revenueInEscrow, activeEvents, payoutDue },
  });
}
