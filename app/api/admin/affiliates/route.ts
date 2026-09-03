import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServerSupabase();

  const [{ data: affiliates, error }, { data: referrals }, { data: commissions }] = await Promise.all([
    db.from('platform_affiliates').select('id, name, email, referral_code, created_at').order('created_at', { ascending: false }),
    db.from('platform_affiliate_referrals').select('affiliate_id'),
    db.from('platform_affiliate_commissions').select('affiliate_id, commission_amount, status'),
  ]);

  if (error) {
    console.error('GET /api/admin/affiliates error', error);
    return NextResponse.json({ error: 'Failed to fetch affiliates' }, { status: 500 });
  }

  const referralCounts = new Map<string, number>();
  for (const r of referrals ?? []) referralCounts.set(r.affiliate_id, (referralCounts.get(r.affiliate_id) ?? 0) + 1);

  const pendingByAffiliate = new Map<string, number>();
  const paidByAffiliate = new Map<string, number>();
  for (const c of commissions ?? []) {
    const map = c.status === 'paid' ? paidByAffiliate : pendingByAffiliate;
    map.set(c.affiliate_id, (map.get(c.affiliate_id) ?? 0) + c.commission_amount);
  }

  const rows = (affiliates ?? []).map(a => ({
    id: a.id,
    name: a.name,
    email: a.email,
    referralCode: a.referral_code,
    createdAt: a.created_at,
    referralCount: referralCounts.get(a.id) ?? 0,
    pendingCommission: pendingByAffiliate.get(a.id) ?? 0,
    paidCommission: paidByAffiliate.get(a.id) ?? 0,
  }));

  return NextResponse.json({ success: true, data: rows });
}
