import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'affiliate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();
  const { data: affiliate } = await db
    .from('platform_affiliates')
    .select('id, name, email, referral_code, created_at, phone, bank_name, account_number, account_name')
    .eq('id', user.sub)
    .maybeSingle();
  if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

  const [{ data: commissions }, { count: referralCount }] = await Promise.all([
    db.from('platform_affiliate_commissions').select('commission_amount, status').eq('affiliate_id', affiliate.id),
    db.from('platform_affiliate_referrals').select('id', { count: 'exact', head: true }).eq('affiliate_id', affiliate.id),
  ]);

  const pendingCommission = (commissions ?? []).filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0);
  const paidCommission = (commissions ?? []).filter(c => c.status === 'paid').reduce((s, c) => s + c.commission_amount, 0);

  return NextResponse.json({
    success: true,
    data: {
      id: affiliate.id,
      name: affiliate.name,
      email: affiliate.email,
      referralCode: affiliate.referral_code,
      referralLink: `${process.env.NEXT_PUBLIC_APP_URL}/organizer/register?aff=${affiliate.referral_code}`,
      referralCount: referralCount ?? 0,
      pendingCommission,
      paidCommission,
      phone: affiliate.phone,
      bankName: affiliate.bank_name,
      accountNumber: affiliate.account_number,
      accountName: affiliate.account_name,
    },
  });
}
