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

    const formData   = await req.formData();
    const bannerFile = formData.get('banner') as File | null;

    if (!bannerFile || bannerFile.size === 0) {
      return NextResponse.json({ error: 'No banner file provided' }, { status: 400 });
    }
    if (bannerFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Banner image must be under 5MB' }, { status: 400 });
    }

    const ext         = bannerFile.name.split('.').pop();
    const path        = `${user.sub}/${uuidv4()}.${ext}`;
    const arrayBuffer = await bannerFile.arrayBuffer();

    const { error: uploadError } = await db.storage
      .from('event-assets')
      .upload(path, arrayBuffer, { contentType: bannerFile.type });

    if (uploadError) throw uploadError;

    const { data: urlData } = db.storage.from('event-assets').getPublicUrl(path);
    const bannerUrl = urlData.publicUrl;

    await db.from('events').update({ banner_url: bannerUrl }).eq('id', id);

    return NextResponse.json({ success: true, data: { bannerUrl } });
  } catch (err) {
    console.error('POST /api/organizer/events/[id]/banner error', err);
    return NextResponse.json({ error: 'Failed to upload banner' }, { status: 500 });
  }
}
