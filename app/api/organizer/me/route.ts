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
    .from('users')
    .select('id, name, email, phone, tier, verified, kyc_status, member_since, events_hosted, bio, bank_name, account_number, account_name, email_notifications, sms_alerts')
    .eq('id', user.sub)
    .maybeSingle();

  if (error) {
    console.error('GET /api/organizer/me db error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}
