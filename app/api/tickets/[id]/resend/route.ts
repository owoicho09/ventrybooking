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
    const { data, error } = await db
      .from('tickets')
      .select(`
        id, buyer_name, buyer_email, quantity, total_paid, refund_code,
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
    if (!data) {
      return NextResponse.json({ error: 'Ticket not found or email mismatch' }, { status: 404 });
    }

    // Supabase infers FK-joined rows as arrays even for many-to-one relations.
    // Normalise to a single object by taking [0] when an array is returned.
    type EvRow   = { event_name: string; date: string; venue: string };
    type TierRow = { name: string };
    const evRaw   = data.event   as EvRow[] | EvRow   | null | undefined;
    const tierRaw = data.tier    as TierRow[] | TierRow | null | undefined;
    const ev   = (Array.isArray(evRaw)   ? evRaw[0]   : evRaw)   ?? null;
    const tier = (Array.isArray(tierRaw) ? tierRaw[0] : tierRaw) ?? null;

    await sendTicketEmail({
      to:         data.buyer_email,
      buyerName:  data.buyer_name || '',
      ticketId:   data.id,
      eventName:  ev?.event_name || '',
      eventDate:  ev?.date || '',
      eventVenue: ev?.venue || '',
      tierName:   tier?.name || '',
      quantity:   data.quantity,
      totalPaid:  data.total_paid,
      refundCode: data.refund_code,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/tickets/[id]/resend error:', err);
    return NextResponse.json({ error: 'Failed to resend ticket' }, { status: 500 });
  }
}
