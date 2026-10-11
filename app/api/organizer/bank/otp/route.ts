import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/server/password';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { sendBankChangeOTPEmail } from '@/lib/server/email';
import { hashBankOTP } from '@/lib/server/bankChange';

/**
 * Step 1 of changing the payout bank account (Organiser Terms 3.8): the
 * organiser re-enters their password and we email a one-time code to their
 * registered address. The code is then required by POST /api/organizer/bank.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkRateLimit(`bank-otp:${user.sub}`, 3, 10 * 60)) {
    return NextResponse.json({ error: 'Too many requests. Wait a few minutes and try again.' }, { status: 429 });
  }

  const { password } = await req.json().catch(() => ({})) as { password?: string };
  if (!password) return NextResponse.json({ error: 'Enter your account password' }, { status: 400 });

  const db = getServerSupabase();
  const { data: u } = await db.from('users').select('id, name, email, password_hash').eq('id', user.sub).maybeSingle();
  if (!u || !u.password_hash || !verifyPassword(password, u.password_hash)) {
    return NextResponse.json({ error: 'That password isn’t right' }, { status: 401 });
  }

  const otp = randomInt(100000, 999999).toString();
  await db.from('users').update({
    bank_change_otp: hashBankOTP(otp, u.id),
    bank_change_otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }).eq('id', u.id);

  try {
    await sendBankChangeOTPEmail(u.email, u.name ?? 'there', otp);
  } catch (err) {
    console.error('bank otp email failed', err);
    return NextResponse.json({ error: 'We couldn’t send the code. Try again in a moment.' }, { status: 502 });
  }
  const masked = u.email.replace(/^(.)(.*)(@.*)$/, (_m: string, a: string, b: string, c: string) => a + '*'.repeat(Math.max(1, b.length)) + c);
  return NextResponse.json({ success: true, data: { sentTo: masked } });
}
