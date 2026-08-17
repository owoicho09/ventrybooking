import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { slugify, isReservedSlug } from '@/lib/slug';

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const allowed = ['name', 'phone', 'bio', 'email_notifications', 'sms_alerts', 'handle', 'socials'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const db = getServerSupabase();

    if (typeof updates.handle === 'string') {
      const handle = slugify(updates.handle);
      if (isReservedSlug(handle)) {
        return NextResponse.json({ error: `"${handle}" isn't available as a handle` }, { status: 400 });
      }
      // Handles and event slugs share one flat URL namespace, so a handle
      // can't be accepted if it's already an event's slug (the reverse —
      // an event slug colliding with a handle — is checked in
      // generateEventSlug).
      const { data: eventMatch } = await db.from('events').select('id').eq('slug', handle).maybeSingle();
      if (eventMatch) {
        return NextResponse.json({ error: `"${handle}" isn't available as a handle` }, { status: 400 });
      }
      updates.handle = handle;
    }

    if (updates.socials !== undefined && typeof updates.socials !== 'object') {
      return NextResponse.json({ error: 'Invalid socials value' }, { status: 400 });
    }

    const { error } = await db.from('users').update(updates).eq('id', user.sub);
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That handle is already taken' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ success: true, data: { message: 'Settings updated', handle: updates.handle } });
  } catch (err) {
    console.error('PATCH /api/organizer/settings error', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
