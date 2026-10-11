import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { submitClaim } from '@/lib/server/refundCases';

/** Refund claim, step 2: the emailed code plus the bank account to be paid into. */
export async function POST(req: NextRequest) {
  if (!checkRateLimit(`refund-claim-submit:${getIp(req.headers)}`, 15, 15 * 60)) {
    return NextResponse.json({ error: 'Too many attempts. Wait a few minutes and try again.' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({})) as { claimId?: string; code?: string; bankName?: string; accountNumber?: string; statement?: string };
  if (!body.claimId || !body.code) return NextResponse.json({ error: 'Enter the code we emailed you' }, { status: 400 });
  try {
    const r = await submitClaim(getServerSupabase(), {
      claimId: body.claimId, code: body.code, bankName: String(body.bankName ?? ''),
      accountNumber: String(body.accountNumber ?? ''), statement: body.statement ?? null,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ success: true, data: r });
  } catch (err) {
    console.error('refund claim submit error', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
