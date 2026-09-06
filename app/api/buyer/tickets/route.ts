import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getBuyerAuth } from '@/lib/server/buyerAuth';

// Claiming a buyer account needs no migration or import step: "my tickets"
// is just every ticket whose buyer_email matches the session email, computed
// at read time — matches the shape /api/tickets/[id] returns so the client
// can reuse the same buildTicket()/TicketCard() pipeline.
export async function GET() {
  const buyer = await getBuyerAuth();
  if (!buyer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const db = getServerSupabase();
  const { data, error } = await db
    .from('tickets')
    .select(`
      id, quantity, buyer_name, buyer_email, total_paid, status, purchased_at, refund_code, paystack_reference,
      event:events!tickets_event_id_fkey(
        id, event_name, category, date, time, event_mode, venue, address, city, landmark, banner_color,
        organizer:users!events_organizer_id_fkey(id, name, tier, verified)
      ),
      tier:ticket_tiers!tickets_tier_id_fkey(id, name, price)
    `)
    .ilike('buyer_email', buyer.email)
    .order('purchased_at', { ascending: false });

  if (error) {
    console.error('GET /api/buyer/tickets error:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }

  type OrgRow   = { id: string; name: string; tier: string; verified: boolean };
  type EventRow = Record<string, unknown> & { organizer: OrgRow[] | OrgRow | null };
  type TierRow  = { id: string; name: string; price: number };
  const one = <T,>(v: T[] | T | null | undefined): T | null => (v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v);

  const tickets = (data ?? []).map(row => {
    const rawEvent  = one(row.event as EventRow[] | EventRow | null);
    const rawTier   = one(row.tier  as TierRow[]  | TierRow  | null);
    const organizer = rawEvent ? one(rawEvent.organizer) : null;
    const event = rawEvent ? { ...rawEvent, organizer } : null;
    return { ...row, event, tier: rawTier };
  });

  return NextResponse.json({ success: true, data: tickets });
}
