import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServerSupabase();
  const { data, error } = await db
    .from('event_reviews')
    .select('id, event_id, rating, body, display_name, hidden, created_at, event:events!event_reviews_event_id_fkey(event_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('GET /api/admin/reviews error', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  const rows = (data ?? []).map(r => {
    const eventRaw = r.event as { event_name: string }[] | { event_name: string } | null;
    const eventName = (Array.isArray(eventRaw) ? eventRaw[0] : eventRaw)?.event_name ?? '';
    return {
      id: r.id,
      eventId: r.event_id,
      eventName,
      rating: r.rating,
      body: r.body,
      displayName: r.display_name,
      hidden: r.hidden,
      createdAt: r.created_at,
    };
  });

  return NextResponse.json({ success: true, data: rows });
}
