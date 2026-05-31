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
    .from('payouts')
    .select(`
      id, event_id, event_name, organizer_name, date, gross, fee, net, status, reference,
      organizer:users!payouts_organizer_id_fkey(id, name, email)
    `)
    .order('date', { ascending: false });

  if (status) qb = qb.eq('status', status);

  const { data, error } = await qb;
  if (error) return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });

  return NextResponse.json({ success: true, data: data || [] });
}
