import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import {
  CHECKOUT_OTP_LENGTH,
  CHECKOUT_OTP_MAX_ATTEMPTS,
  hashCheckoutOTP,
  normalizeCheckoutEmail,
  signCheckoutEmailToken,
} from '@/lib/server/checkoutEmailVerification';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();
    const normalized = normalizeCheckoutEmail(email);
    const submitted = String(otp ?? '').trim();

    if (!normalized || !new RegExp(`^\\d{${CHECKOUT_OTP_LENGTH}}$`).test(submitted)) {
      return NextResponse.json({ error: `Enter the ${CHECKOUT_OTP_LENGTH}-digit code sent to your email` }, { status: 400 });
    }

    const ip = getIp(req.headers);
    if (!checkRateLimit(`checkout-otp-verify-ip:${ip}`, 30, 10 * 60)) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
    }

    const db = getServerSupabase();
    const { data: otpRow, error: otpErr } = await db
      .from('checkout_email_otps')
      .select('id, otp_hash, expires_at, attempts')
      .eq('email', normalized)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (otpErr) {
      console.error('checkout email OTP lookup error', otpErr);
      return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
    }

    const EXPIRED = NextResponse.json({ error: 'That code has expired or is no longer valid. Request a new one.' }, { status: 400 });
    if (!otpRow) return EXPIRED;
    if (new Date(otpRow.expires_at) < new Date()) {
      await db.from('checkout_email_otps').delete().eq('id', otpRow.id);
      return EXPIRED;
    }
    if (otpRow.attempts >= CHECKOUT_OTP_MAX_ATTEMPTS) {
      await db.from('checkout_email_otps').delete().eq('id', otpRow.id);
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 });
    }

    const expected = Buffer.from(otpRow.otp_hash);
    const actual = Buffer.from(hashCheckoutOTP(submitted, normalized));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const attempts = otpRow.attempts + 1;
      await db.from('checkout_email_otps').update({ attempts }).eq('id', otpRow.id);
      const left = CHECKOUT_OTP_MAX_ATTEMPTS - attempts;
      return NextResponse.json(
        { error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.' },
        { status: 400 },
      );
    }

    // Single-use — burn it so it can't be replayed.
    await db.from('checkout_email_otps').delete().eq('id', otpRow.id);

    return NextResponse.json({ success: true, data: { emailToken: signCheckoutEmailToken(normalized) } });
  } catch (err) {
    console.error('POST /api/checkout/email-otp/verify error', err);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
