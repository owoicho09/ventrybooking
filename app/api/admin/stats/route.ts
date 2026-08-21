import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServerSupabase();

  const [eventsRes, ticketsRes, activeTicketsRes, payoutsRes, kycRes, complaintsRes] = await Promise.all([
    db.from('events').select('id, status'),
    db.from('tickets').select('quantity').in('status', ['valid', 'used']),
    // Every non-refunded ticket, event_id'd — the base data for both revenue
    // (service fee) and escrow (full ticket price), split out below.
    db.from('tickets').select('event_id, total_paid, service_fee').neq('status', 'refunded'),
    db.from('payouts').select('event_id, fee, status'),
    db.from('users').select('id').eq('kyc_status', 'pending'),
    db.from('complaints').select('id').in('status', ['open', 'investigating']),
  ]);

  const events        = eventsRes.data       || [];
  const tickets       = ticketsRes.data      || [];
  const activeTickets = activeTicketsRes.data || [];
  const payouts       = payoutsRes.data      || [];

  // Revenue = what Ventry has actually earned, not what passed through us.
  // - Service fee is ours the moment a ticket sells (and stays excluded if refunded).
  // - The 3% (or organizer's grandfathered rate) cut of ticket price isn't ours
  //   until the payout for that event has actually been released — otp_pending
  //   covers "released but awaiting OTP confirmation", which Paystack already
  //   accepted the transfer for.
  const releasedEventIds = new Set(
    payouts.filter(p => p.status === 'otp_pending' || p.status === 'completed').map(p => p.event_id),
  );
  const serviceFeeRevenue = activeTickets.reduce((s, t) => s + (t.service_fee ?? 0), 0);
  const payoutFeeRevenue  = payouts
    .filter(p => p.status === 'otp_pending' || p.status === 'completed')
    .reduce((s, p) => s + (p.fee ?? 0), 0);

  // Escrow = full ticket price for every non-refunded ticket on an event whose
  // payout hasn't released yet — the money currently sitting with Ventry that
  // still needs to be there to cover organizer payouts.
  const fundsInEscrow = activeTickets
    .filter(t => !releasedEventIds.has(t.event_id))
    .reduce((s, t) => s + (t.total_paid ?? 0), 0);

  return NextResponse.json({
    success: true,
    data: {
      totalEvents:      events.length,
      activeEvents:     events.filter(e => e.status === 'approved').length,
      totalTicketsSold: tickets.reduce((s, t) => s + t.quantity, 0),
      totalRevenue:     serviceFeeRevenue + payoutFeeRevenue,
      fundsInEscrow,
      pendingKYC:       kycRes.data?.length  || 0,
      openComplaints:   complaintsRes.data?.length || 0,
    },
  });
}
