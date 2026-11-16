import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };
const SELECT = 'id, label, token, active, view_count, last_viewed_at, created_at';
const MAX_LINKS = 25;

/** Sponsor monitor links for one of this organiser's events (056). */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = getServerSupabase();
  const { data, error } = await db
    .from('monitor_links').select(SELECT)
    .eq('event_id', id).eq('organizer_id', user.sub)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Failed to load links' }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

/** Create a link: { label }. */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = getServerSupabase();

  const { data: event } = await db.from('events').select('id').eq('id', id).eq('organizer_id', user.sub).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const { count } = await db.from('monitor_links').select('id', { count: 'exact', head: true }).eq('event_id', id);
  if ((count ?? 0) >= MAX_LINKS) {
    return NextResponse.json({ error: `Up to ${MAX_LINKS} links per event. Switch an old one off and reuse it.` }, { status: 400 });
  }

  const { label } = await req.json().catch(() => ({})) as { label?: unknown };
  const cleanLabel = String(label ?? '').trim().slice(0, 80) || null;
  const { data, error } = await db
    .from('monitor_links')
    .insert({ organizer_id: user.sub, event_id: id, label: cleanLabel, token: randomBytes(32).toString('hex') })
    .select(SELECT)
    .single();
  if (error) {
    console.error('POST monitor link error', error.message);
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data }, { status: 201 });
}
