import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { voidAffiliateCommissionsForOrganizer } from '@/lib/server/affiliateCommission';
import { getBankCode } from '@/lib/banks';
import { resolveAccountName } from '@/lib/server/paystack';
import { fullNamesMatch } from '@/lib/identityMatch';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bankName, accountNumber, legalName } = await req.json();
    if (!bankName || !accountNumber) {
      return NextResponse.json({ error: 'All bank fields are required' }, { status: 400 });
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Account number must be 10 digits' }, { status: 400 });
    }

    const bankCode = getBankCode(bankName);
    if (!bankCode) {
      return NextResponse.json({ error: `Unknown bank "${bankName}"` }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: me } = await db.from('users')
      .select('identity_status, identity_type, identity_name, legal_name')
      .eq('id', user.sub).maybeSingle();
    const verified = me?.identity_status === 'verified';

    // The account name comes from the bank (via Paystack), never from what
    // was typed: settlement only goes to an account in the organiser's own
    // verified name (Organiser Terms 3.4, 3.8, 8.4).
    let resolvedName: string;
    try {
      resolvedName = await resolveAccountName({ accountNumber, bankCode });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not verify this account';
      return NextResponse.json({ error: `We couldn\u2019t confirm that account with the bank: ${message}` }, { status: 400 });
    }

    const isCompany = me?.identity_type === 'cac';
    const nameToMatch = verified ? me?.identity_name : (typeof legalName === 'string' && legalName.trim()) || me?.legal_name || null;
    const matched = nameToMatch ? fullNamesMatch(resolvedName, nameToMatch, { company: isCompany }) : null;
    if (verified && matched === false) {
      return NextResponse.json({
        error: `This account is registered to "${resolvedName}", which doesn\u2019t match your verified name "${me?.identity_name}". Payouts can only go to an account in your own verified name.`,
      }, { status: 400 });
    }

    const update: Record<string, string | boolean | null> = {
      bank_name: bankName,
      account_number: accountNumber,
      account_name: resolvedName,
      bank_name_matched: matched,
    };
    // Once verified, the legal name is the verified one and can't be edited here.
    if (!verified && typeof legalName === 'string' && legalName.trim()) {
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

    return NextResponse.json({
      success: true,
      data: {
        message: matched === false
          ? `Saved. Note: the bank has this account as "${resolvedName}", which doesn\u2019t match your legal name. Payouts will need an account in your own name once you verify.`
          : 'Bank details saved',
        accountName: resolvedName,
        matched,
      },
    });
  } catch (err) {
    console.error('POST /api/organizer/bank error', err);
    return NextResponse.json({ error: 'Failed to save bank details' }, { status: 500 });
  }
}
