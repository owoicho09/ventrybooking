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
      id, name:event_name, category, date, city, venue, status, description, banner_url, venue_proof_url,
      organizer:users!events_organizer_id_fkey(id, name, tier, verified),
      tiers:ticket_tiers(id, name, price, available)
    `)
    .order('created_at', { ascending: false });

  if (status) qb = qb.eq('status', status);

  const { data, error } = await qb;
  if (error) return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });

  return NextResponse.json({ success: true, data: data || [] });
}
