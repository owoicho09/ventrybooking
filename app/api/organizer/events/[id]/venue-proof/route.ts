import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { notify } from '@/lib/server/notify';

const MAX_MB = 10;
const ALLOWED = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/;

/**
 * Upload (or replace) the written proof of the venue booking after the event
 * was created — needed with a venue contact for the Verified badge
 * (Organiser Terms 4.2). Replacing it removes an existing badge until the
 * admin checks the new document.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const db = getServerSupabase();
    const { data: event } = await db.from('events').select('id, organizer_id, event_name, verified').eq('id', id).maybeSingle();
    if (!event || event.organizer_id !== user.sub) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const form = await req.formData();
    const file = form.get('venueProof') as File | null;
    if (!file || file.size === 0) return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 });
    if (file.size > MAX_MB * 1024 * 1024) return NextResponse.json({ error: `The file must be under ${MAX_MB}MB` }, { status: 400 });
    if (file.type && !ALLOWED.test(file.type)) return NextResponse.json({ error: 'Upload a PDF or a photo of the document' }, { status: 400 });

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `venue-proofs/${user.sub}/${uuidv4()}.${ext}`;
    const { error: uploadError } = await db.storage.from('event-assets')
      .upload(path, await file.arrayBuffer(), { contentType: file.type || 'application/octet-stream' });
    if (uploadError) throw uploadError;
    const url = db.storage.from('event-assets').getPublicUrl(path).data.publicUrl;

    await db.from('events').update({
      venue_proof_url: url,
      // A new document needs checking again before the badge returns.
      ...(event.verified ? { verified: false, verified_at: null, verified_by: null } : {}),
    }).eq('id', id);

    notify(
      { type: 'admin' },
      { notifType: 'event', title: 'Venue proof uploaded', body: `New venue proof for "${event.event_name}". Check it and call the venue contact before adding the Verified badge.`, link: '/admin/events' },
    ).catch(console.error);

    return NextResponse.json({ success: true, data: { url } });
  } catch (err) {
    console.error('POST venue-proof error', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
