import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServerSupabase();

  const [eventsRes, ticketsRes, escrowRes, kycRes, complaintsRes] = await Promise.all([
    db.from('events').select('id, status'),
    db.from('tickets').select('quantity').in('status', ['valid', 'used']),
    db.from('tickets').select('total_paid').in('status', ['valid', 'used']),
    db.from('users').select('id').eq('kyc_status', 'pending'),
    db.from('complaints').select('id').in('status', ['open', 'investigating']),
  ]);

  const events  = eventsRes.data  || [];
  const tickets = ticketsRes.data || [];
  const escrow  = escrowRes.data  || [];

  return NextResponse.json({
    success: true,
    data: {
      totalEvents:      events.length,
      activeEvents:     events.filter(e => e.status === 'approved').length,
      totalTicketsSold: tickets.reduce((s, t) => s + t.quantity, 0),
      revenueInEscrow:  escrow.reduce((s, t) => s + t.total_paid, 0),
      pendingKYC:       kycRes.data?.length  || 0,
      openComplaints:   complaintsRes.data?.length || 0,
    },
  });
}
