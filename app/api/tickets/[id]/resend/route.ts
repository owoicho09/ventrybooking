import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendTicketEmail } from '@/lib/server/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { email } = await req.json();

    const db = getServerSupabase();

    // Fetch the requested ticket to verify the email address and get the reference
    const { data: anchor, error } = await db
      .from('tickets')
      .select(`
        id, buyer_name, buyer_email, paystack_reference, total_paid,
        event:events!tickets_event_id_fkey(event_name, date, venue),
        tier:ticket_tiers!tickets_tier_id_fkey(name)
      `)
      .eq('id', id)
      .ilike('buyer_email', (email || '').trim())
      .maybeSingle();

    if (error) {
      console.error('POST /api/tickets/[id]/resend error:', error);
      return NextResponse.json({ error: 'Failed to find ticket' }, { status: 500 });
    }
    if (!anchor) {
      return NextResponse.json({ error: 'Ticket not found or email mismatch' }, { status: 404 });
    }

    type EvRow   = { event_name: string; date: string; venue: string };
    type TierRow = { name: string };
    const evRaw   = anchor.event   as EvRow[]   | EvRow   | null | undefined;
    const tierRaw = anchor.tier    as TierRow[] | TierRow | null | undefined;
    const ev   = (Array.isArray(evRaw)   ? evRaw[0]   : evRaw)   ?? null;
    const tier = (Array.isArray(tierRaw) ? tierRaw[0] : tierRaw) ?? null;

    // Fetch all tickets that belong to the same Paystack transaction so the
    // resent email contains every QR code the buyer paid for.
    const { data: siblings } = await db
      .from('tickets')
      .select('id, refund_code, total_paid')
      .eq('paystack_reference', anchor.paystack_reference)
      .order('purchased_at', { ascending: true });

    const tickets = (siblings || [{ id: anchor.id, refund_code: anchor.id, total_paid: anchor.total_paid }])
      .map(t => ({ ticketId: t.id, refundCode: t.refund_code }));

    const totalPaid = (siblings || []).reduce((s, t) => s + (t.total_paid ?? 0), 0) || anchor.total_paid;

    await sendTicketEmail({
      to:          anchor.buyer_email,
      buyerName:   anchor.buyer_name || '',
      tickets,
      paystackRef: anchor.paystack_reference,
      eventName:   ev?.event_name || '',
      eventDate:   ev?.date || '',
      eventVenue:  ev?.venue || '',
      tierName:    tier?.name || '',
      totalPaid,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/tickets/[id]/resend error:', err);
    return NextResponse.json({ error: 'Failed to resend ticket' }, { status: 500 });
  }
}
