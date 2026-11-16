import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');

  const db = getServerSupabase();
  let qb = db
    .from('events')
    .select(`
      id, name:event_name, category, date, city, event_mode, venue, address, landmark, location_hidden,
      meeting_link, meeting_passcode,
      status, submitted_at, reviewed_at, reviewed_by, rejection_reason, goes_live_at,
      description, banner_url, venue_proof_url, verified, verified_at, verified_by, venue_contact_name, venue_contact_phone,
      organizer:users!events_organizer_id_fkey(id, name, tier, verified),
      tiers:ticket_tiers(id, name, price, available)
    `);

  if (status) qb = qb.eq('status', status);
  // The review queue reads oldest-first: whoever has waited longest is next.
  qb = status === 'under_review'
    ? qb.order('submitted_at', { ascending: true, nullsFirst: true })
    : qb.order('created_at', { ascending: false });

  const { data, error } = await qb;
  if (error) return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });

  return NextResponse.json({ success: true, data: data || [] });
}
