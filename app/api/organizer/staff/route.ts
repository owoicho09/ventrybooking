import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { generateStaffCode } from '@/lib/server/ids';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();
  const { data, error } = await db
    .from('staff_ids')
    .select(`
      id, code, label, active, expires_at, created_at,
      event:events!staff_ids_event_id_fkey(id, event_name, date)
    `)
    .eq('organizer_id', user.sub)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch staff IDs' }, { status: 500 });
  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId, label } = await req.json();
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 });

  const db = getServerSupabase();

  // Verify the event belongs to this organizer and get its date for expiry
  const { data: event } = await db
    .from('events')
    .select('id, date, organizer_id')
    .eq('id', eventId)
    .eq('organizer_id', user.sub)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Staff ID expires 24 hours after the event date
  const expiresAt = new Date(new Date(event.date).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const code = generateStaffCode();
  const { data, error } = await db
    .from('staff_ids')
    .insert({
      code,
      organizer_id: user.sub,
      event_id:     eventId,
      label:        label?.trim() || null,
      active:       true,
      expires_at:   expiresAt,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create staff ID' }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
