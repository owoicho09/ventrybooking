import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServerSupabase();

    const { data: affiliates, error } = await db
      .from('affiliates')
      .select('id, name, code, clicks, buys, event_id, created_at, event:events!affiliates_event_id_fkey(event_name, slug)')
      .eq('organizer_id', user.sub)
      .order('created_at', { ascending: false });

    if (error) throw error;

    type EventRow = { event_name: string; slug: string | null };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const data = (affiliates ?? []).map(a => {
      const ev = (Array.isArray(a.event) ? a.event[0] : a.event) as EventRow | null;
      return {
        id: a.id,
        name: a.name,
        code: a.code,
        clicks: a.clicks,
        buys: a.buys,
        eventId: a.event_id,
        eventName: ev?.event_name ?? '',
        link: `${appUrl}/${ev?.slug || `events/${a.event_id}`}?ref=${a.code}`,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('GET /api/organizer/affiliates error', err);
    return NextResponse.json({ error: 'Failed to fetch affiliates' }, { status: 500 });
  }
}
