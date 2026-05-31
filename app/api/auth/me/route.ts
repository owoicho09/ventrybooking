import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role === 'admin') {
    return NextResponse.json({ success: true, data: { role: 'admin', email: user.email } });
  }

  const db = getServerSupabase();
  const { data, error } = await db
    .from('users')
    .select('id, name, email, phone, tier, verified, kyc_status, member_since, events_hosted, bio, bank_name, account_number, email_notifications, sms_alerts')
    .eq('id', user.sub)
    .single();

  if (error || !data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: { ...data, role: 'organizer' } });
}
