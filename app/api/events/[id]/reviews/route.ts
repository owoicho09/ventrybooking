import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';

const DISPLAY_NAMES = [
  'Verified Attendee',
  'Anonymous Attendee',
  'Event Enthusiast',
  'Happy Patron',
  'Night Out Regular',
  'Satisfied Guest',
  'Crowd Regular',
  'Keen Goer',
];

function generateReviewId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(8);
  return 'REV-' + Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

function hashIp(ip: string): string {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET!)
    .update(ip)
    .digest('hex')
    .slice(0, 32);
}

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
        .order('created_at', { ascending: false })
        .limit(50),
      db.from('event_reviews')
        .select('rating')
        .eq('event_id', id),
      db.from('event_reviews')
        .select('rating')
        .eq('organizer_id', event.organizer_id),
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getIp(req.headers);
  if (!checkRateLimit(`review:${ip}`, 5, 15 * 60)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const { id } = await params;
    const { rating, body } = await req.json();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be a whole number between 1 and 5' }, { status: 400 });
    }
    if (body && typeof body === 'string' && body.length > 500) {
      return NextResponse.json({ error: 'Review must be 500 characters or fewer' }, { status: 400 });
    }

    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('id, date, organizer_id, status')
      .eq('id', id)
      .maybeSingle();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (new Date(event.date) > new Date()) {
      return NextResponse.json(
        { error: 'Reviews can only be submitted after the event has taken place' },
        { status: 400 },
      );
    }
    if (event.status === 'rejected') {
      return NextResponse.json({ error: 'Cannot review this event' }, { status: 400 });
    }

    const ipHash      = hashIp(ip);
    const reviewId    = generateReviewId();
    const displayName = DISPLAY_NAMES[Math.floor(Math.random() * DISPLAY_NAMES.length)];
    const cleanBody   = typeof body === 'string' && body.trim() ? body.trim() : null;

    const { error: insertErr } = await db.from('event_reviews').insert({
      id:           reviewId,
      event_id:     id,
      organizer_id: event.organizer_id,
      rating,
      body:         cleanBody,
      display_name: displayName,
      ip_hash:      ipHash,
      created_at:   new Date().toISOString(),
    });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'You have already reviewed this event' }, { status: 409 });
      }
      console.error('POST /api/events/[id]/reviews insert error', insertErr);
      return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id:           reviewId,
        rating,
        body:         cleanBody,
        display_name: displayName,
        created_at:   new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('POST /api/events/[id]/reviews error', err);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
