import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// GET — organiser's Audience: names only, never email addresses. Buyer email
// stays server-side; this response is the one place that guarantee must hold.
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();
  const { data, error } = await db
    .from('organizer_subscribers')
    .select('id, name, source, subscribed_at')
    .eq('organizer_id', user.sub)
    .is('unsubscribed_at', null)
    .order('subscribed_at', { ascending: false });

  if (error) {
    console.error('GET /api/organizer/audience error', error);
    return NextResponse.json({ error: 'Failed to fetch audience' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      count: data?.length ?? 0,
      members: (data ?? []).map(m => ({
        id: m.id,
        name: m.name || null,
        source: m.source,
        subscribed_at: m.subscribed_at,
      })),
    },
  });
}
