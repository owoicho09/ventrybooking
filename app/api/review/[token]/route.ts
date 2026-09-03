import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyTicketLink } from '@/lib/server/ticketLinks';

// GET — read-only preview: is this ticket eligible, and has it already reviewed?
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let payload;
  try {
    payload = verifyTicketLink(token);
  } catch {
    return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 });
  }
  if (payload.purpose !== 'review') {
    return NextResponse.json({ error: 'This link is not a valid review link.' }, { status: 400 });
  }

  const db = getServerSupabase();

  const { data: ticket } = await db
    .from('tickets')
    .select('id, event_id, buyer_name')
    .eq('id', payload.ticketId)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

  const { data: event } = await db.from('events').select('event_name').eq('id', ticket.event_id).maybeSingle();

  const { data: existing } = await db
    .from('event_reviews')
    .select('id, rating, body')
    .eq('ticket_id', ticket.id)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    data: {
      eventName: event?.event_name ?? '',
      buyerName: ticket.buyer_name,
      alreadyReviewed: !!existing,
      existingReview: existing ?? null,
    },
  });
}

// POST — submit the review. One per ticket, enforced by the unique
// constraint on event_reviews.ticket_id.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let payload;
  try {
    payload = verifyTicketLink(token);
  } catch {
    return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 });
  }
  if (payload.purpose !== 'review') {
    return NextResponse.json({ error: 'This link is not a valid review link.' }, { status: 400 });
  }

  const { rating, body } = await req.json().catch(() => ({}));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be a whole number between 1 and 5' }, { status: 400 });
  }
  if (body && typeof body === 'string' && body.length > 500) {
    return NextResponse.json({ error: 'Review must be 500 characters or fewer' }, { status: 400 });
  }

  const db = getServerSupabase();

  const { data: ticket } = await db
    .from('tickets')
    .select('id, event_id, buyer_name')
    .eq('id', payload.ticketId)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

  const { data: event } = await db.from('events').select('organizer_id').eq('id', ticket.event_id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });

  const cleanBody = typeof body === 'string' && body.trim() ? body.trim() : null;
  const displayName = ticket.buyer_name?.trim() || 'Verified Attendee';

  const { error: insertErr } = await db.from('event_reviews').insert({
    id: `REV-${payload.ticketId}`,
    event_id: ticket.event_id,
    organizer_id: event.organizer_id,
    ticket_id: ticket.id,
    rating,
    body: cleanBody,
    display_name: displayName,
    created_at: new Date().toISOString(),
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'This ticket has already been used to leave a review.' }, { status: 409 });
    }
    console.error('POST /api/review/[token] insert error', insertErr);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
