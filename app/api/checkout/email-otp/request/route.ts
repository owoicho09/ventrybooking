import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { sendCheckoutOTPEmail } from '@/lib/server/email';
import {
  CHECKOUT_OTP_LENGTH,
  CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS,
  CHECKOUT_OTP_TTL_MS,
  hashCheckoutOTP,
  isPlausibleEmail,
  normalizeCheckoutEmail,
} from '@/lib/server/checkoutEmailVerification';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalized = normalizeCheckoutEmail(email);
    if (!isPlausibleEmail(normalized)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const ip = getIp(req.headers);
    if (
      !checkRateLimit(`checkout-otp-send:${normalized}`, 5, 10 * 60) ||
      !checkRateLimit(`checkout-otp-send-ip:${ip}`, 15, 10 * 60)
    ) {
      return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
    }

    const db = getServerSupabase();

    // Cooldown lives in the database (not the in-memory limiter) so it holds
    // across serverless instances and stops "Resend" being used to spam an
    // inbox that isn't the requester's.
    const { data: latest } = await db
      .from('checkout_email_otps')
      .select('created_at')
      .eq('email', normalized)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      const elapsed = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
      if (elapsed < CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS) {
        const retryAfter = Math.ceil(CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS - elapsed);
        return NextResponse.json(
          { error: `Please wait ${retryAfter}s before requesting another code.`, retryAfter },
          { status: 429 },
        );
      }
    }

    const otp = randomInt(0, 10 ** CHECKOUT_OTP_LENGTH).toString().padStart(CHECKOUT_OTP_LENGTH, '0');

    // One active code per email — a resend invalidates the previous one.
    await db.from('checkout_email_otps').delete().eq('email', normalized);
    const { data: inserted, error: insertErr } = await db
      .from('checkout_email_otps')
      .insert({
        email: normalized,
        otp_hash: hashCheckoutOTP(otp, normalized),
        expires_at: new Date(Date.now() + CHECKOUT_OTP_TTL_MS).toISOString(),
      })
      .select('id')
      .single();
    if (insertErr || !inserted) {
      console.error('checkout email OTP insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to send the code. Please try again.' }, { status: 500 });
    }

    try {
      await sendCheckoutOTPEmail(normalized, otp);
    } catch (emailErr) {
      console.error('checkout email OTP send failed:', emailErr);
      // Don't leave an unsent code behind — it would trip the resend
      // cooldown and lock the buyer out of retrying for a minute.
      await db.from('checkout_email_otps').delete().eq('id', inserted.id);
      return NextResponse.json(
        { error: "We couldn't send a code to that address. Check that it's spelled correctly and try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { cooldownSeconds: CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS, codeLength: CHECKOUT_OTP_LENGTH },
    });
  } catch (err) {
    console.error('POST /api/checkout/email-otp/request error', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
