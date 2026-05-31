import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();

  const [ticketsRes, eventsRes, payoutsRes] = await Promise.all([
    db.from('tickets').select('quantity').eq('organizer_id', user.sub).in('status', ['valid', 'used']),
    db.from('events').select('id, status').eq('organizer_id', user.sub),
    // Fetch pending + processing payouts — "in escrow" is the net they will receive
    db.from('payouts').select('net, status').eq('organizer_id', user.sub).in('status', ['pending', 'processing']),
  ]);

  const tickets = ticketsRes.data || [];
  const events  = eventsRes.data  || [];
  const payouts = payoutsRes.data || [];

  const ticketsSold     = tickets.reduce((s, t) => s + t.quantity, 0);
  // Show only the organizer's net (after 2.5% platform fee), never the gross or service fees
  const revenueInEscrow = payouts.reduce((s, p) => s + p.net, 0);
  const activeEvents    = events.filter(e => e.status === 'approved').length;
  const payoutDue       = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.net, 0);

  return NextResponse.json({
    success: true,
    data: { ticketsSold, revenueInEscrow, activeEvents, payoutDue },
  });
}
