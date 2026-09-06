import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getBuyerAuth } from '@/lib/server/buyerAuth';

// Reviews have no buyer_email of their own — they join back to a buyer only
// through event_reviews.ticket_id -> tickets.buyer_email (same path
// app/api/review/[token]/route.ts uses to attribute a review to a ticket).
// Queried from the tickets side so the buyer_email filter applies to the
// table it's actually a column on.
export async function GET() {
  const buyer = await getBuyerAuth();
  if (!buyer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const db = getServerSupabase();
  const { data, error } = await db
    .from('tickets')
    .select(`
      id,
      event:events!tickets_event_id_fkey(event_name),
      review:event_reviews!event_reviews_ticket_id_fkey(id, rating, body, created_at)
    `)
    .ilike('buyer_email', buyer.email);

  if (error) {
    console.error('GET /api/buyer/reviews error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  type EvRow  = { event_name: string };
  type RevRow = { id: string; rating: number; body: string | null; created_at: string };
  const one = <T,>(v: T[] | T | null | undefined): T | null => (v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v);

  const reviews = (data ?? [])
    .map(row => {
      const review = one(row.review as RevRow[] | RevRow | null);
      const event  = one(row.event  as EvRow[]  | EvRow  | null);
      return review ? { ...review, eventName: event?.event_name ?? '' } : null;
    })
    .filter((r): r is RevRow & { eventName: string } => !!r);

  return NextResponse.json({ success: true, data: reviews });
}
