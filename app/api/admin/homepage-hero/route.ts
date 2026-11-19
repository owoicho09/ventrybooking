import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * The homepage hero deck (063): which three events float in the hero, in
 * order (slot 1 is the card on top).
 *
 * GET  -> { slots: [eventId|null x3], candidates: on-sale events with artwork }
 * PUT  { eventIds: string[] }  up to 3, in order; [] goes back to automatic
 */

async function admin() {
  const user = await getAuthUser();
  return user && user.role === 'admin' ? user : null;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getServerSupabase();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  const [slotsRes, eventsRes] = await Promise.all([
    db.from('homepage_hero').select('slot, event_id').order('slot'),
    db.from('events')
      .select('id, event_name, slug, date, city, banner_url, header_banner_url, goes_live_at, organizer:users!events_organizer_id_fkey(name)')
      .eq('status', 'approved')
      .gte('date', today)
      .order('date'),
  ]);
  if (slotsRes.error || eventsRes.error) {
    console.error('GET homepage-hero error', slotsRes.error ?? eventsRes.error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
  const now = Date.now();
  const candidates = (eventsRes.data ?? [])
    .filter(e => (e.banner_url || e.header_banner_url) && !(e.goes_live_at && new Date(e.goes_live_at).getTime() > now))
    .map(e => {
      const org = Array.isArray(e.organizer) ? e.organizer[0] : e.organizer;
      return {
        id: e.id, name: e.event_name, slug: e.slug, date: String(e.date).slice(0, 10), city: e.city,
        image: e.banner_url || e.header_banner_url, organizer: (org as { name?: string } | null)?.name ?? '',
      };
    });
  const slots: (string | null)[] = [null, null, null];
  for (const s of slotsRes.data ?? []) slots[s.slot - 1] = s.event_id;
  return NextResponse.json({ success: true, data: { slots, candidates } });
}

export async function PUT(req: NextRequest) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { eventIds } = await req.json().catch(() => ({})) as { eventIds?: unknown };
  const ids = Array.isArray(eventIds) ? eventIds.map(String).filter(Boolean) : null;
  if (!ids || ids.length > 3 || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'Pick up to 3 different events' }, { status: 400 });
  }

  const db = getServerSupabase();
  if (ids.length) {
    const { data: found } = await db.from('events').select('id').in('id', ids).eq('status', 'approved');
    if ((found ?? []).length !== ids.length) {
      return NextResponse.json({ error: 'Every hero event must be a live (approved) event' }, { status: 400 });
    }
  }

  const { error: delErr } = await db.from('homepage_hero').delete().gte('slot', 1);
  if (delErr) {
    console.error('PUT homepage-hero delete error', delErr);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
  if (ids.length) {
    const rows = ids.map((id, i) => ({ slot: i + 1, event_id: id, updated_at: new Date().toISOString(), updated_by: user.email }));
    const { error } = await db.from('homepage_hero').insert(rows);
    if (error) {
      console.error('PUT homepage-hero insert error', error);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }
  }
  // Show the new deck straight away rather than at the next 60s refresh.
  revalidatePath('/');
  return NextResponse.json({ success: true });
}
