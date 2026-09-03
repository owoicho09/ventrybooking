import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

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

// Anonymous, unauthenticated review submission is retired — reviews are now
// tied to a checked-in ticket via the signed link emailed after the event
// (see /api/review/[token]), matching the platform's "identity lives in the
// ticket" thesis instead of an IP-hash-deduped anonymous form.
export async function POST() {
  return NextResponse.json(
    { error: 'Reviews can only be submitted via the link emailed to checked-in ticket holders after the event.' },
    { status: 410 },
  );
}
