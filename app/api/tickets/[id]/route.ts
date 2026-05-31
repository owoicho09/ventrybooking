import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { generateQRDataUrl } from '@/lib/server/qr';

type OrgRow   = { id: string; name: string; tier: string; verified: boolean };
type EventRow = {
  id: string; event_name: string; category: string; date: string; time: string;
  venue: string; address: string; city: string; banner_color: string;
  organizer: OrgRow[] | OrgRow | null;
};
type TierRow  = { id: string; name: string; price: number };

function one<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

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

    const rawEvent  = one(data.event  as EventRow[] | EventRow | null);
    const rawTier   = one(data.tier   as TierRow[]  | TierRow  | null);
    const organizer = rawEvent ? one(rawEvent.organizer as OrgRow[] | OrgRow | null) : null;

    const event = rawEvent
      ? { ...rawEvent, name: rawEvent.event_name, organizer }
      : null;

    return NextResponse.json({
      success: true,
      data: { ...data, event, tier: rawTier, qrDataUrl },
    });
  } catch (err) {
    console.error('GET /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}
