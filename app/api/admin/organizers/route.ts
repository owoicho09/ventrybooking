import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const kycStatus = searchParams.get('kyc_status');

  const db = getServerSupabase();
  let qb = db
    .from('users')
    .select('id, name, email, phone, tier, verified, member_since, events_hosted, kyc_status, kyc_submitted_at, kyc_gov_id_path, kyc_selfie_path')
    .order('kyc_submitted_at', { ascending: false });

  if (kycStatus) qb = qb.eq('kyc_status', kycStatus);

  const { data, error } = await qb;
  if (error) return NextResponse.json({ error: 'Failed to fetch organizers' }, { status: 500 });

  return NextResponse.json({ success: true, data: data || [] });
}
