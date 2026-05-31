import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();
  const { data, error } = await db
    .from('payouts')
    .select('id, event_id, event_name, date, gross, fee, net, status, reference')
    .eq('organizer_id', user.sub)
    .order('date', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  return NextResponse.json({ success: true, data: data || [] });
}
