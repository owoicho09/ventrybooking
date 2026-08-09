import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { createHash, randomInt } from 'crypto';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { sendTicketLookupOTPEmail } from '@/lib/server/email';

function hashOTP(otp: string, email: string): string {
  return createHash('sha256').update(otp + email).digest('hex');
}

const GENERIC_MESSAGE = 'If tickets exist for that email, a verification code has been sent.';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!normalized) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const ip = getIp(req.headers);
    if (
      !checkRateLimit(`ticket-otp-send:${normalized}`, 3, 10 * 60) ||
      !checkRateLimit(`ticket-otp-send-ip:${ip}`, 10, 10 * 60)
    ) {
      return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
    }

    const db = getServerSupabase();
    const { count } = await db
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .ilike('buyer_email', normalized);

    // Always respond the same way whether or not tickets exist for this
    // email — otherwise the endpoint becomes an email-enumeration oracle.
    if (!count) {
      return NextResponse.json({ success: true, data: { message: GENERIC_MESSAGE } });
    }

    const otp = randomInt(1000, 10000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // One active code per email — clear any prior unused one.
    await db.from('ticket_lookup_otps').delete().eq('email', normalized);
    const { error: insertErr } = await db.from('ticket_lookup_otps').insert({
      email: normalized,
      otp_hash: hashOTP(otp, normalized),
      expires_at: expiresAt,
    });
    if (insertErr) {
      // Don't email a code that was never actually persisted — it could
      // never pass verify-otp, which would just look like a broken code
      // to the buyer.
      console.error('ticket lookup OTP insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    try {
      await sendTicketLookupOTPEmail(normalized, otp);
    } catch (emailErr) {
      console.error('ticket lookup OTP email failed:', emailErr);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { message: GENERIC_MESSAGE } });
  } catch (err) {
    console.error('POST /api/tickets/retrieve/request-otp error', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
