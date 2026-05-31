import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { generateQRDataUrl } from '@/lib/server/qr';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data, error } = await db
      .from('tickets')
      .select(`
        id, quantity, buyer_name, buyer_email, total_paid, status, purchased_at, refund_code, qr_token,
        event:events!tickets_event_id_fkey(
          id, event_name, category, date, time, venue, address, city, banner_color,
          organizer:users!events_organizer_id_fkey(id, name, tier, verified)
        ),
        tier:ticket_tiers!tickets_tier_id_fkey(id, name, price)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('GET /api/tickets/[id] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const qrDataUrl = data.qr_token ? await generateQRDataUrl(data.qr_token) : null;

    // Normalise event_name → name so downstream code uses the Event type consistently
    const event = data.event
      ? { ...data.event, name: (data.event as Record<string, unknown>).event_name }
      : null;

    return NextResponse.json({
      success: true,
      data: { ...data, event, qrDataUrl },
    });
  } catch (err) {
    console.error('GET /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}
