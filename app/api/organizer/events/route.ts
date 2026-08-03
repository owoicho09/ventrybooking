import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { notify } from '@/lib/server/notify';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');

  let qb = db
    .from('events')
    .select(`
      id, name:event_name, category, date, time, event_mode, venue, city, status, total_sold, banner_color,
      tiers:ticket_tiers(id, name, price, available, sold)
    `)
    .eq('organizer_id', user.sub)
    .order('date', { ascending: false });

  if (status) qb = qb.eq('status', status);

  const { data, error } = await qb;
  if (error) return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });

  // Compute totalSold from ticket_tiers.sold (the live counter kept by
  // increment_tier_sold) rather than relying on events.total_sold directly.
  // This also fixes the snake_case → camelCase mismatch the dashboard expects.
  type RawTier = { id: string; name: string; price: number; available: number; sold: number };
  const mapped = (data || []).map(ev => ({
    ...ev,
    totalSold: ((ev.tiers as RawTier[]) ?? []).reduce((sum, t) => sum + (t.sold ?? 0), 0),
  }));

  return NextResponse.json({ success: true, data: mapped });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServerSupabase();
    const organizerId = user.sub;

    // Verify KYC approved
    const { data: org, error: orgError } = await db.from('users').select('verified').eq('id', organizerId).maybeSingle();
    if (orgError) {
      console.error('POST /api/organizer/events kyc check db error:', orgError.message);
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }
    if (!org || !org.verified) {
      return NextResponse.json({ error: 'KYC verification required before creating events' }, { status: 403 });
    }

    const formData = await req.formData();
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const description = formData.get('description') as string;
    const date = formData.get('date') as string;
    const time = formData.get('time') as string;
    const eventMode = (formData.get('eventMode') as string) === 'online' ? 'online' : 'physical';
    const venue = (formData.get('venue') as string) || '';
    const address = (formData.get('address') as string) || '';
    const city = formData.get('city') as string;
    const landmark = formData.get('landmark') as string;
    const locationHidden = formData.get('locationHidden') === 'true';
    const meetingLink = (formData.get('meetingLink') as string) || '';
    const meetingPasscode = (formData.get('meetingPasscode') as string) || '';
    const tiersJson = formData.get('tiers') as string;
    const bannerFile = formData.get('banner') as File | null;
    const venueProofFile = formData.get('venueProof') as File | null;

    if (!name || !category || !description || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (eventMode === 'physical' && (!venue || !address)) {
      return NextResponse.json({ error: 'Venue name and address are required' }, { status: 400 });
    }
    if (eventMode === 'online' && !meetingLink) {
      return NextResponse.json({ error: 'Meeting link is required for online events' }, { status: 400 });
    }

    async function uploadEventFile(file: File, folder: string, maxMb: number) {
      if (file.size > maxMb * 1024 * 1024) {
        throw new Error(`${folder === 'venue-proofs' ? 'Venue proof' : 'Banner image'} must be under ${maxMb}MB`);
      }
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${folder}/${organizerId}/${uuidv4()}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await db.storage
        .from('event-assets')
        .upload(path, arrayBuffer, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) {
        throw uploadError;
      }
      const { data: urlData } = db.storage.from('event-assets').getPublicUrl(path);
      return urlData.publicUrl;
    }

    let bannerUrl: string | null = null;
    if (bannerFile && bannerFile.size > 0) {
      bannerUrl = await uploadEventFile(bannerFile, 'banners', 5);
    }

    let venueProofUrl: string | null = null;
    if (venueProofFile && venueProofFile.size > 0) {
      venueProofUrl = await uploadEventFile(venueProofFile, 'venue-proofs', 10);
    }

    const tiers = tiersJson ? JSON.parse(tiersJson) : [];

    const { data: eventData, error: insertError } = await db.from('events').insert({
      event_name: name,
      category,
      description,
      date,
      time,
      event_mode: eventMode,
      venue,
      address,
      city: city || '',
      landmark: landmark || null,
      location_hidden: locationHidden,
      meeting_link: eventMode === 'online' ? meetingLink : null,
      meeting_passcode: eventMode === 'online' && meetingPasscode ? meetingPasscode : null,
      organizer_id: organizerId,
      status: 'under_review',
      total_sold: 0,
      banner_url: bannerUrl,
      venue_proof_url: venueProofUrl,
      banner_color: 'from-purple-900 to-indigo-900',
      created_at: new Date().toISOString(),
    }).select('id').single();

    if (insertError) throw insertError;

    const eventId = eventData.id;

    // Insert ticket tiers
    if (tiers.length > 0) {
      const tierInserts = tiers.map((t: { name: string; price: string; quantity: string }) => ({
        event_id: eventId,
        name: t.name,
        price: Number(t.price),
        available: Number(t.quantity),
        sold: 0,
      }));
      await db.from('ticket_tiers').insert(tierInserts);
    }

    notify(
      { type: 'admin' },
      { notifType: 'event', title: 'New Event Submitted', body: `"${name}" has been submitted for review.`, link: '/admin/events' },
    ).catch(console.error);

    return NextResponse.json({ success: true, data: { eventId } }, { status: 201 });
  } catch (err) {
    console.error('POST /api/organizer/events error', err);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
