import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { createHash, randomInt } from 'crypto';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { sendBuyerLoginOTPEmail } from '@/lib/server/email';

function hashOTP(otp: string, email: string): string {
  return createHash('sha256').update(otp + email).digest('hex');
}

const GENERIC_MESSAGE = 'If that email is valid, a sign-in code has been sent.';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const ip = getIp(req.headers);
    if (
      !checkRateLimit(`buyer-otp-send:${normalized}`, 3, 10 * 60) ||
      !checkRateLimit(`buyer-otp-send-ip:${ip}`, 10, 10 * 60)
    ) {
      return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
    }

    // Unlike /api/tickets/retrieve, buyer login has no ticket-count gate —
    // signing in is not conditioned on already owning a ticket, so every
    // valid email always gets a code.
    const otp = randomInt(1000, 10000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const db = getServerSupabase();
    await db.from('buyer_login_otps').delete().eq('email', normalized);
    const { error: insertErr } = await db.from('buyer_login_otps').insert({
      email: normalized,
      otp_hash: hashOTP(otp, normalized),
      expires_at: expiresAt,
    });
    if (insertErr) {
      console.error('buyer login OTP insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    try {
      await sendBuyerLoginOTPEmail(normalized, otp);
    } catch (emailErr) {
      console.error('buyer login OTP email failed:', emailErr);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { message: GENERIC_MESSAGE } });
  } catch (err) {
    console.error('POST /api/buyer/auth/request-otp error', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
