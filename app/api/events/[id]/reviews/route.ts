import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUUID } from '@/lib/slug';
import {
  REVIEW_MAX_BODY_LENGTH,
  getReviewEligibility,
  publicReviewName,
  verifyReviewToken,
} from '@/lib/server/eventReviews';

function calcStats(rows: { rating: number }[] | null): { avg: number | null; count: number } {
  if (!rows?.length) return { avg: null, count: 0 };
  const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  return { avg: Math.round(avg * 10) / 10, count: rows.length };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('organizer_id')
      .eq('id', id)
      .maybeSingle();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const [{ data: reviews }, { data: eventRatings }, { data: orgRatings }] = await Promise.all([
      db.from('event_reviews')
        .select('id, rating, body, display_name, created_at')
        .eq('event_id', id)
        .eq('hidden', false)
        .order('created_at', { ascending: false })
        .limit(50),
      db.from('event_reviews')
        .select('rating')
        .eq('event_id', id)
        .eq('hidden', false),
      db.from('event_reviews')
        .select('rating')
        .eq('organizer_id', event.organizer_id)
        .eq('hidden', false),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        reviews:        reviews ?? [],
        eventStats:     calcStats(eventRatings),
        organizerStats: calcStats(orgRatings),
      },
    });
  } catch (err) {
    console.error('GET /api/events/[id]/reviews error', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// Anonymous, unauthenticated review submission stays retired. A review needs
// proof of both things: that the email bought a ticket for THIS event
// (eligibility, checked here) and that the submitter can read that inbox (the
// reviewToken minted by /review-verify after the emailed code). The other
// route in is the signed link emailed after the event (/api/review/[token]).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUUID(id)) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { reviewToken, rating, body } = await req.json().catch(() => ({}));

    const email = verifyReviewToken(reviewToken, id);
    if (!email) {
      return NextResponse.json({ error: 'Please confirm your email again to post a review.', code: 'REVIEW_NOT_VERIFIED' }, { status: 403 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be a whole number between 1 and 5' }, { status: 400 });
    }
    if (body != null && typeof body !== 'string') {
      return NextResponse.json({ error: 'Invalid review text' }, { status: 400 });
    }
    if (typeof body === 'string' && body.length > REVIEW_MAX_BODY_LENGTH) {
      return NextResponse.json({ error: `Review must be ${REVIEW_MAX_BODY_LENGTH} characters or fewer` }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: event } = await db.from('events').select('id, organizer_id, status').eq('id', id).maybeSingle();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.status !== 'completed') {
      return NextResponse.json({ error: 'Reviews open once the event has ended.' }, { status: 403 });
    }

    const { tickets, alreadyReviewed } = await getReviewEligibility(db, id, email);
    if (tickets.length === 0) {
      return NextResponse.json({ error: 'Only people who bought a ticket for this event can review it.' }, { status: 403 });
    }
    if (alreadyReviewed) {
      return NextResponse.json({ error: "You've already reviewed this event. Thanks for sharing your experience!" }, { status: 409 });
    }

    // The review hangs off the buyer's earliest ticket; the unique constraint
    // on event_reviews.ticket_id is what backstops a double-submit race.
    const ticket = tickets[0];
    const cleanBody = typeof body === 'string' && body.trim() ? body.trim() : null;
    const { error: insertErr } = await db.from('event_reviews').insert({
      id: `REV-${ticket.id}`,
      event_id: id,
      organizer_id: event.organizer_id,
      ticket_id: ticket.id,
      rating,
      body: cleanBody,
      display_name: publicReviewName(ticket.buyer_name),
      created_at: new Date().toISOString(),
    });
    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: "You've already reviewed this event. Thanks for sharing your experience!" }, { status: 409 });
      }
      console.error('POST /api/events/[id]/reviews insert error', insertErr);
      return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/events/[id]/reviews error', err);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
