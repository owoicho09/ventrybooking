import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
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

    const { data: event } = await db
      .from('events')
      .select('id, organizer_id')
      .eq('id', id)
      .single();

    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const photoFile = formData.get('photo') as File | null;

    if (!photoFile || photoFile.size === 0) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }
    if (photoFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Lineup photo must be under 5MB' }, { status: 400 });
    }

    const ext = photoFile.name.split('.').pop() || 'jpg';
    const path = `lineup/${user.sub}/${uuidv4()}.${ext}`;
    const arrayBuffer = await photoFile.arrayBuffer();

    const { error: uploadError } = await db.storage
      .from('event-assets')
      .upload(path, arrayBuffer, { contentType: photoFile.type || 'application/octet-stream' });

    if (uploadError) throw uploadError;

    const { data: urlData } = db.storage.from('event-assets').getPublicUrl(path);

    return NextResponse.json({ success: true, data: { url: urlData.publicUrl } });
  } catch (err) {
    console.error('POST /api/organizer/events/[id]/lineup-photo error', err);
    return NextResponse.json({ error: 'Failed to upload lineup photo' }, { status: 500 });
  }
}
