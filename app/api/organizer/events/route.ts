import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

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
      id, name:event_name, category, date, time, venue, city, status, total_sold, banner_color,
      tiers:ticket_tiers(id, name, price, available, sold)
    `)
    .eq('organizer_id', user.sub)
    .order('date', { ascending: false });

  if (status) qb = qb.eq('status', status);

  const { data, error } = await qb;
  if (error) return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });

  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServerSupabase();

    // Verify KYC approved
    const { data: org, error: orgError } = await db.from('users').select('verified').eq('id', user.sub).maybeSingle();
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
    const venue = formData.get('venue') as string;
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const tiersJson = formData.get('tiers') as string;
    const bannerFile = formData.get('banner') as File | null;

    if (!name || !category || !description || !date || !time || !venue || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let bannerUrl: string | null = null;
    if (bannerFile && bannerFile.size > 0) {
      if (bannerFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Banner image must be under 5MB' }, { status: 400 });
      }
      const ext = bannerFile.name.split('.').pop();
      const path = `${user.sub}/${uuidv4()}.${ext}`;
      const arrayBuffer = await bannerFile.arrayBuffer();
      const { error: uploadError } = await db.storage
        .from('event-assets')
        .upload(path, arrayBuffer, { contentType: bannerFile.type });
      if (!uploadError) {
        const { data: urlData } = db.storage.from('event-assets').getPublicUrl(path);
        bannerUrl = urlData.publicUrl;
      }
    }

    const tiers = tiersJson ? JSON.parse(tiersJson) : [];

    const { data: eventData, error: insertError } = await db.from('events').insert({
      event_name: name,
      category,
      description,
      date,
      time,
      venue,
      address,
      city: city || '',
      organizer_id: user.sub,
      status: 'under_review',
      total_sold: 0,
      banner_url: bannerUrl,
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

    return NextResponse.json({ success: true, data: { eventId } }, { status: 201 });
  } catch (err) {
    console.error('POST /api/organizer/events error', err);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
