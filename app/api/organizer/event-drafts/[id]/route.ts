import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// Drafts hold text form state only (images stay in the browser), so anything
// near this size is not a real draft.
const MAX_DRAFT_BYTES = 200_000;
const MAX_DRAFTS_PER_ORGANIZER = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

async function organizer() {
  const user = await getAuthUser();
  return user && user.role === 'organizer' ? user : null;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await organizer();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  const { data, error } = await getServerSupabase()
    .from('event_drafts')
    .select('id, name, data, updated_at')
    .eq('id', id)
    .eq('organizer_id', user.sub)
    .maybeSingle();
  if (error) {
    console.error('GET /api/organizer/event-drafts/[id] error', error);
    return NextResponse.json({ error: 'Failed to load draft' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

/** Create or overwrite a draft. The browser generates the id. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await organizer();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 });

  const raw = await req.text();
  if (raw.length > MAX_DRAFT_BYTES) {
    return NextResponse.json({ error: 'Draft is too large' }, { status: 413 });
  }
  let body: { name?: unknown; data?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid draft' }, { status: 400 }); }
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    return NextResponse.json({ error: 'Invalid draft' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';

  const db = getServerSupabase();
  const { data: existing, error: findErr } = await db
    .from('event_drafts').select('organizer_id').eq('id', id).maybeSingle();
  if (findErr) {
    console.error('PUT /api/organizer/event-drafts/[id] lookup error', findErr);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
  if (existing && existing.organizer_id !== user.sub) {
    return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 });
  }

  const now = new Date().toISOString();
  if (existing) {
    const { error } = await db.from('event_drafts')
      .update({ name, data: body.data, updated_at: now })
      .eq('id', id).eq('organizer_id', user.sub);
    if (error) {
      console.error('PUT /api/organizer/event-drafts/[id] update error', error);
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }
  } else {
    const { count } = await db.from('event_drafts')
      .select('id', { count: 'exact', head: true }).eq('organizer_id', user.sub);
    if ((count ?? 0) >= MAX_DRAFTS_PER_ORGANIZER) {
      return NextResponse.json({ error: `You can keep up to ${MAX_DRAFTS_PER_ORGANIZER} drafts. Delete an old one from My Events to save this one.` }, { status: 409 });
    }
    const { error } = await db.from('event_drafts')
      .insert({ id, organizer_id: user.sub, name, data: body.data, created_at: now, updated_at: now });
    if (error) {
      console.error('PUT /api/organizer/event-drafts/[id] insert error', error);
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true, data: { id, updated_at: now } });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await organizer();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ success: true });

  const { error } = await getServerSupabase()
    .from('event_drafts').delete().eq('id', id).eq('organizer_id', user.sub);
  if (error) {
    console.error('DELETE /api/organizer/event-drafts/[id] error', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
