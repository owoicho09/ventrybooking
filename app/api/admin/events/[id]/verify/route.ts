import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Sets an event's Verified badge. Per the Organiser Terms 4.2 the badge means
 * Ventry has written proof of the venue booking AND has confirmed it with
 * the venue for that date; the admin confirms the call before turning it on.
 * Body: { verified: boolean }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { verified?: unknown };
  if (typeof body.verified !== 'boolean') {
    return NextResponse.json({ error: 'verified must be true or false' }, { status: 400 });
  }

  const db = getServerSupabase();
  if (body.verified) {
    const { data: ev } = await db.from('events').select('venue_proof_url, venue_contact_phone').eq('id', id).maybeSingle();
    if (ev && (!ev.venue_proof_url || !ev.venue_contact_phone)) {
      return NextResponse.json({ error: 'The badge needs venue proof on file and a venue contact you have called' }, { status: 400 });
    }
  }
  const { data, error } = await db
    .from('events')
    .update(body.verified
      ? { verified: true, verified_at: new Date().toISOString(), verified_by: user.email }
      : { verified: false, verified_at: null, verified_by: null })
    .eq('id', id)
    .select('id, verified, verified_at, verified_by')
    .maybeSingle();

  if (error) {
    console.error('POST /api/admin/events/[id]/verify error', error);
    return NextResponse.json({ error: 'Could not update the badge' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}
