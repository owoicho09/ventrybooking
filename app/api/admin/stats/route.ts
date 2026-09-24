import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServerSupabase();

  const [eventsRes, ticketsRes, activeTicketsRes, settlementsRes, kycRes, complaintsRes] = await Promise.all([
    db.from('events').select('id, status'),
    db.from('tickets').select('quantity').in('status', ['valid', 'used']),
    // Every non-refunded ticket, event_id'd — the base data for both revenue
    // (service fee) and unsettled funds (full ticket price), split out below.
    db.from('tickets').select('settlement_id, total_paid, service_fee').neq('status', 'refunded'),
    db.from('settlements').select('id, fee, status'),
    db.from('users').select('id').eq('kyc_status', 'pending'),
    db.from('complaints').select('id').in('status', ['open', 'investigating']),
  ]);

  const events        = eventsRes.data       || [];
  const tickets       = ticketsRes.data      || [];
  const activeTickets = activeTicketsRes.data || [];
  const settlements   = settlementsRes.data  || [];

  // Revenue = what Ventry has actually earned, not what passed through us.
  // - Service fee is ours the moment a ticket sells (and stays excluded if refunded).
  // - The platform fee (3%, or an organiser's grandfathered rate) is ours once
  //   the settlement carrying it has actually been sent — daily settlements and
  //   the legacy escrow payouts copied into the same ledger alike.
  const sent = settlements.filter(s => s.status === 'successful');
  const sentSettlementIds = new Set(sent.map(s => s.id));
  const serviceFeeRevenue = activeTickets.reduce((s, t) => s + (t.service_fee ?? 0), 0);
  const payoutFeeRevenue  = sent.reduce((s, p) => s + Number(p.fee ?? 0), 0);

  // Unsettled funds = full amount paid for every non-refunded ticket whose
  // money hasn't been sent to its organiser yet — what Ventry is still holding.
  const unsettledFunds = activeTickets
    .filter(t => !t.settlement_id || !sentSettlementIds.has(t.settlement_id))
    .reduce((s, t) => s + (t.total_paid ?? 0), 0);

  return NextResponse.json({
    success: true,
    data: {
      totalEvents:      events.length,
      activeEvents:     events.filter(e => e.status === 'approved').length,
      totalTicketsSold: tickets.reduce((s, t) => s + t.quantity, 0),
      totalRevenue:     serviceFeeRevenue + payoutFeeRevenue,
      unsettledFunds,
      pendingKYC:       kycRes.data?.length  || 0,
      openComplaints:   complaintsRes.data?.length || 0,
    },
  });
}
