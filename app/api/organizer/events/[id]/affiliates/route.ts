import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { generateAffiliateCode } from '@/lib/server/ids';

export async function GET(
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
      .select('id, organizer_id')
      .eq('id', id)
      .single();

    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: affiliates, error } = await db
      .from('affiliates')
      .select('id, name, code, clicks, buys, created_at')
      .eq('event_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const data = (affiliates ?? []).map(a => ({
      ...a,
      link: `${appUrl}/events/${id}?ref=${a.code}`,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('GET /api/organizer/events/[id]/affiliates error', err);
    return NextResponse.json({ error: 'Failed to fetch affiliates' }, { status: 500 });
  }
}

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

    const { name } = await req.json();
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'Affiliate name is required' }, { status: 400 });
    }

    const code = generateAffiliateCode();

    const { data: affiliate, error } = await db
      .from('affiliates')
      .insert({
        code,
        name: trimmedName,
        event_id: id,
        organizer_id: user.sub,
      })
      .select('id, name, code, clicks, buys, created_at')
      .single();

    if (error) throw error;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

    return NextResponse.json({
      success: true,
      data: { ...affiliate, link: `${appUrl}/events/${id}?ref=${affiliate.code}` },
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/organizer/events/[id]/affiliates error', err);
    return NextResponse.json({ error: 'Failed to create affiliate' }, { status: 500 });
  }
}
