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
    const bannerFile = formData.get('headerBanner') as File | null;

    if (!bannerFile || bannerFile.size === 0) {
      return NextResponse.json({ error: 'No header banner file provided' }, { status: 400 });
    }
    if (bannerFile.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Header banner image must be under 8MB' }, { status: 400 });
    }

    const { compressToWebp } = await import('@/lib/server/imageCompress');
    const webp = await compressToWebp(await bannerFile.arrayBuffer(), { maxWidth: 2160, maxHeight: 1080 });
    const path = `header-banners/${user.sub}/${uuidv4()}.webp`;

    const { error: uploadError } = await db.storage
      .from('event-assets')
      .upload(path, webp, { contentType: 'image/webp' });

    if (uploadError) throw uploadError;

    const { data: urlData } = db.storage.from('event-assets').getPublicUrl(path);
    const headerBannerUrl = urlData.publicUrl;

    await db.from('events').update({ header_banner_url: headerBannerUrl }).eq('id', id);

    return NextResponse.json({ success: true, data: { headerBannerUrl } });
  } catch (err) {
    console.error('POST /api/organizer/events/[id]/header-banner error', err);
    return NextResponse.json({ error: 'Failed to upload header banner' }, { status: 500 });
  }
}
