import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * An event's flyers (061): up to 3, in display order. banner_url always
 * mirrors the first, so cards, ticket emails and share previews keep using
 * one picture.
 *
 * POST   multipart { flyer, index? }  replace the flyer at `index`, or add one
 * PATCH  { order: string[] }          reorder (same URLs, new order)
 * DELETE ?index=n                     remove one
 */

const MAX_FLYERS = 3;
const MAX_MB = 5;
type Ctx = { params: Promise<{ id: string }> };

async function owned(id: string, organizerId: string) {
  const db = getServerSupabase();
  const { data: event } = await db.from('events').select('id, organizer_id, banner_url, flyer_urls').eq('id', id).maybeSingle();
  if (!event || event.organizer_id !== organizerId) return { db, event: null, flyers: [] as string[] };
  const flyers: string[] = Array.isArray(event.flyer_urls) && event.flyer_urls.length
    ? event.flyer_urls.filter(Boolean)
    : (event.banner_url ? [event.banner_url] : []);
  return { db, event, flyers };
}

async function save(db: ReturnType<typeof getServerSupabase>, id: string, flyers: string[]) {
  const list = flyers.slice(0, MAX_FLYERS);
  const { error } = await db.from('events')
    .update({ flyer_urls: list.length ? list : null, banner_url: list[0] ?? null })
    .eq('id', id);
  if (error) throw error;
  return list;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const { db, event, flyers } = await owned(id, user.sub);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const form = await req.formData();
    const file = form.get('flyer') as File | null;
    const rawIndex = form.get('index');
    const index = rawIndex === null || rawIndex === '' ? null : Number(rawIndex);
    if (!file || file.size === 0) return NextResponse.json({ error: 'No flyer image provided' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Flyers must be images' }, { status: 400 });
    if (file.size > MAX_MB * 1024 * 1024) return NextResponse.json({ error: `Each flyer must be under ${MAX_MB}MB` }, { status: 400 });
    const replacing = index !== null && Number.isInteger(index) && index >= 0 && index < flyers.length;
    if (!replacing && flyers.length >= MAX_FLYERS) {
      return NextResponse.json({ error: `An event can have up to ${MAX_FLYERS} flyers. Remove or replace one first.` }, { status: 400 });
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `banners/${user.sub}/${uuidv4()}.${ext}`;
    const { error: upErr } = await db.storage.from('event-assets').upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (upErr) throw upErr;
    const url = db.storage.from('event-assets').getPublicUrl(path).data.publicUrl;

    const next = [...flyers];
    if (replacing) next[index as number] = url; else next.push(url);
    const list = await save(db, id, next);
    return NextResponse.json({ success: true, data: { flyerUrls: list } });
  } catch (err) {
    console.error('POST /api/organizer/events/[id]/flyers error', err);
    return NextResponse.json({ error: 'Failed to upload flyer' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const { db, event, flyers } = await owned(id, user.sub);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    const { order } = await req.json().catch(() => ({})) as { order?: unknown };
    const want = Array.isArray(order) ? order.map(String) : [];
    const same = want.length === flyers.length && [...want].sort().join('\n') === [...flyers].sort().join('\n');
    if (!same) return NextResponse.json({ error: 'The flyers changed in the meantime. Reload and try again.' }, { status: 409 });
    const list = await save(db, id, want);
    return NextResponse.json({ success: true, data: { flyerUrls: list } });
  } catch (err) {
    console.error('PATCH /api/organizer/events/[id]/flyers error', err);
    return NextResponse.json({ error: 'Failed to reorder flyers' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const { db, event, flyers } = await owned(id, user.sub);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    const index = Number(req.nextUrl.searchParams.get('index'));
    if (!Number.isInteger(index) || index < 0 || index >= flyers.length) {
      return NextResponse.json({ error: 'That flyer no longer exists. Reload and try again.' }, { status: 404 });
    }
    const list = await save(db, id, flyers.filter((_, i) => i !== index));
    return NextResponse.json({ success: true, data: { flyerUrls: list } });
  } catch (err) {
    console.error('DELETE /api/organizer/events/[id]/flyers error', err);
    return NextResponse.json({ error: 'Failed to remove flyer' }, { status: 500 });
  }
}
