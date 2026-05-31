import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    // Verify ownership
    const { data: event } = await db
      .from('events')
      .select('id, organizer_id, status')
      .eq('id', id)
      .single();

    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.status === 'approved') {
      return NextResponse.json({ error: 'Approved events cannot be edited' }, { status: 403 });
    }

    const body = await req.json();
    const allowed = ['name', 'description', 'date', 'time', 'venue', 'address', 'city', 'category'];
    const updates: Record<string, string> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const { error } = await db.from('events').update(updates).eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/organizer/events/[id] error', err);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('id, organizer_id, status')
      .eq('id', id)
      .single();

    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.status === 'approved') {
      return NextResponse.json({ error: 'Cannot delete an approved event' }, { status: 403 });
    }

    await db.from('events').delete().eq('id', id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/organizer/events/[id] error', err);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
