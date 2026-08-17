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
    const formData  = await req.formData();
    const avatarFile = formData.get('avatar') as File | null;

    if (!avatarFile || avatarFile.size === 0) {
      return NextResponse.json({ error: 'No avatar file provided' }, { status: 400 });
    }
    if (avatarFile.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Avatar image must be under 2MB' }, { status: 400 });
    }

    const ext         = avatarFile.name.split('.').pop();
    // Reuses the event-assets bucket (already public) under its own prefix,
    // mirroring the banner-upload path pattern — no new bucket needed.
    const path        = `avatars/${user.sub}/${uuidv4()}.${ext}`;
    const arrayBuffer = await avatarFile.arrayBuffer();

    const { error: uploadError } = await db.storage
      .from('event-assets')
      .upload(path, arrayBuffer, { contentType: avatarFile.type });

    if (uploadError) throw uploadError;

    const { data: urlData } = db.storage.from('event-assets').getPublicUrl(path);
    const avatarUrl = urlData.publicUrl;

    await db.from('users').update({ avatar_url: avatarUrl }).eq('id', user.sub);

    return NextResponse.json({ success: true, data: { avatarUrl } });
  } catch (err) {
    console.error('POST /api/organizer/avatar error', err);
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }
}
