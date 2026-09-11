import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getBankCode, namesLikelyMatch } from '@/lib/banks';
import { resolveAccountName } from '@/lib/server/paystack';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'affiliate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { phone, bankName, accountNumber } = await req.json();
    if (!phone || !bankName || !accountNumber) {
      return NextResponse.json({ error: 'Phone, bank and account number are all required' }, { status: 400 });
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Account number must be 10 digits' }, { status: 400 });
    }

    const bankCode = getBankCode(bankName);
    if (!bankCode) {
      return NextResponse.json({ error: `Unknown bank "${bankName}"` }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: affiliate } = await db.from('platform_affiliates').select('name').eq('id', user.sub).maybeSingle();
    if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    let resolvedName: string;
    try {
      resolvedName = await resolveAccountName({ accountNumber, bankCode });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not verify this account';
      return NextResponse.json({ error: `Bank account verification failed: ${message}` }, { status: 400 });
    }

    // Account must be in the affiliate's own name — this is the commission
    // payout account, not a third party's, and the bank-resolved name may
    // legitimately be fuller than what was typed at signup, so this is a
    // loose word-overlap match rather than exact string equality.
    if (!namesLikelyMatch(affiliate.name, resolvedName)) {
      return NextResponse.json(
        { error: `This account is registered to "${resolvedName}", which doesn't match your name on file. Commission can only be paid into an account in your own name.` },
        { status: 400 },
      );
    }

    await db.from('platform_affiliates').update({
      phone,
      bank_name: bankName,
      account_number: accountNumber,
      account_name: resolvedName,
    }).eq('id', user.sub);

    return NextResponse.json({ success: true, data: { accountName: resolvedName } });
  } catch (err) {
    console.error('POST /api/affiliate/bank error', err);
    return NextResponse.json({ error: 'Failed to save bank details' }, { status: 500 });
  }
}
