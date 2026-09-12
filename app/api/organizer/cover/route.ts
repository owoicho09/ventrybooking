import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServerSupabase();
    const formData = await req.formData();
    const coverFile = formData.get('cover') as File | null;

    if (!coverFile || coverFile.size === 0) {
      return NextResponse.json({ error: 'No cover image provided' }, { status: 400 });
    }
    if (coverFile.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Cover image must be under 8MB' }, { status: 400 });
    }

    const { compressToWebp } = await import('@/lib/server/imageCompress');
    const webp = await compressToWebp(await coverFile.arrayBuffer(), { maxWidth: 2160, maxHeight: 1080 });
    const path = `organizer-covers/${user.sub}/${uuidv4()}.webp`;

    const { error: uploadError } = await db.storage
      .from('event-assets')
      .upload(path, webp, { contentType: 'image/webp' });

    if (uploadError) throw uploadError;

    const { data: urlData } = db.storage.from('event-assets').getPublicUrl(path);
    const coverImageUrl = urlData.publicUrl;

    await db.from('users').update({ cover_image_url: coverImageUrl }).eq('id', user.sub);

    return NextResponse.json({ success: true, data: { coverImageUrl } });
  } catch (err) {
    console.error('POST /api/organizer/cover error', err);
    return NextResponse.json({ error: 'Failed to upload cover image' }, { status: 500 });
  }
}
