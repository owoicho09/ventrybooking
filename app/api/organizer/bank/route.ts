import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { voidAffiliateCommissionsForOrganizer } from '@/lib/server/affiliateCommission';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bankName, accountNumber, accountName, legalName } = await req.json();
    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'All bank fields are required' }, { status: 400 });
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Account number must be 10 digits' }, { status: 400 });
    }

    const db = getServerSupabase();
    const update: Record<string, string> = {
      bank_name: bankName,
      account_number: accountNumber,
      account_name: accountName,
    };
    if (typeof legalName === 'string' && legalName.trim()) {
      update.legal_name = legalName.trim().slice(0, 200);
    }
    await db.from('users').update(update).eq('id', user.sub);

    // Self-referral check: if this organizer was credited to an affiliate,
    // and the settlement account they just entered matches that affiliate's
    // own bank account, block the referral from earning any further
    // commission and void whatever's still pending on it.
    const { data: referral } = await db
      .from('platform_affiliate_referrals')
      .select('id, affiliate_id, self_referral_blocked')
      .eq('organizer_id', user.sub)
      .maybeSingle();
    if (referral && !referral.self_referral_blocked) {
      const { data: affiliate } = await db
        .from('platform_affiliates')
        .select('account_number')
        .eq('id', referral.affiliate_id)
        .maybeSingle();
      if (affiliate?.account_number && affiliate.account_number === accountNumber) {
        await db.from('platform_affiliate_referrals').update({ self_referral_blocked: true }).eq('id', referral.id);
        await voidAffiliateCommissionsForOrganizer(db, user.sub);
      }
    }

    return NextResponse.json({ success: true, data: { message: 'Bank details saved' } });
  } catch (err) {
    console.error('POST /api/organizer/bank error', err);
    return NextResponse.json({ error: 'Failed to save bank details' }, { status: 500 });
  }
}
