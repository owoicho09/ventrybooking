import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { notify } from '@/lib/server/notify';
import { checkNewsletterEntitlement } from '@/lib/server/entitlements';

const MAX_IMAGES = 3;
const MAX_IMAGE_MB = 5;

// GET — organiser's own submitted mails, most recent first, with status.
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();
  const { data, error } = await db
    .from('newsletters')
    .select('id, subject, body, image_urls, status, rejection_reason, recipient_count, submitted_at, reviewed_at, sent_at')
    .eq('organizer_id', user.sub)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('GET /api/organizer/newsletters error', error);
    return NextResponse.json({ error: 'Failed to fetch newsletters' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

// POST — submit a mail for admin review. Nothing sends yet; this only
// creates a pending draft.
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const entitlement = await checkNewsletterEntitlement(user.sub);
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 402 });
    }

    const db = getServerSupabase();
    const formData = await req.formData();
    const subject = ((formData.get('subject') as string) || '').trim();
    const body = ((formData.get('body') as string) || '').trim();
    const imageFiles = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);

    if (!subject || !body) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
    }
    if (imageFiles.length > MAX_IMAGES) {
      return NextResponse.json({ error: `You can attach at most ${MAX_IMAGES} images` }, { status: 400 });
    }
    for (const file of imageFiles) {
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        return NextResponse.json({ error: `Each image must be under ${MAX_IMAGE_MB}MB` }, { status: 400 });
      }
    }

    const imageUrls: string[] = [];
    for (const file of imageFiles) {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `newsletter-images/${user.sub}/${uuidv4()}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await db.storage
        .from('event-assets')
        .upload(path, arrayBuffer, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) {
        console.error('POST /api/organizer/newsletters: image upload error', uploadError);
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
      }
      const { data: urlData } = db.storage.from('event-assets').getPublicUrl(path);
      imageUrls.push(urlData.publicUrl);
    }

    const { data: created, error: insertErr } = await db
      .from('newsletters')
      .insert({
        organizer_id: user.sub,
        subject,
        body,
        image_urls: imageUrls,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('POST /api/organizer/newsletters: insert error', insertErr);
      return NextResponse.json({ error: 'Failed to submit mail' }, { status: 500 });
    }

    notify(
      { type: 'admin' },
      {
        notifType: 'newsletter',
        title:     'New mail submitted for review',
        body:      `"${subject}" is waiting in the newsletter queue.`,
        link:      '/admin/newsletters',
      },
    ).catch(console.error);

    return NextResponse.json({ success: true, data: { id: created.id } }, { status: 201 });
  } catch (err) {
    console.error('POST /api/organizer/newsletters error', err);
    return NextResponse.json({ error: 'Failed to submit mail' }, { status: 500 });
  }
}
