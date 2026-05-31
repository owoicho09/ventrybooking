import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { generateQRDataUrl } from '@/lib/server/qr';
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
        id, buyer_name, buyer_email, quantity, total_paid, refund_code, qr_token,
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

    const qrDataUrl = data.qr_token ? await generateQRDataUrl(data.qr_token) : '';
    const ev = data.event as { event_name: string; date: string; venue: string } | null;
    const tier = data.tier as { name: string } | null;

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
      qrDataUrl,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/tickets/[id]/resend error:', err);
    return NextResponse.json({ error: 'Failed to resend ticket' }, { status: 500 });
  }
}
