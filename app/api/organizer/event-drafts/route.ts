import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

/** The organiser's saved Create Event drafts, newest first (059). */
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = getServerSupabase();
  const { data, error } = await db
    .from('event_drafts')
    .select('id, name, updated_at')
    .eq('organizer_id', user.sub)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('GET /api/organizer/event-drafts error', error);
    return NextResponse.json({ error: 'Failed to load drafts' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: data ?? [] });
}
