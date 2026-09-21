import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { isUUID } from '@/lib/slug';
import { normalizeCheckoutEmail } from '@/lib/server/checkoutEmailVerification';
import {
  REVIEW_OTP_LENGTH,
  REVIEW_OTP_MAX_ATTEMPTS,
  hashReviewOTP,
  signReviewToken,
} from '@/lib/server/eventReviews';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { email, otp } = await req.json().catch(() => ({}));
    const normalized = normalizeCheckoutEmail(email);
    const submitted = String(otp ?? '').trim();

    if (!isUUID(id)) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (!normalized || !new RegExp(`^\\d{${REVIEW_OTP_LENGTH}}$`).test(submitted)) {
      return NextResponse.json({ error: `Enter the ${REVIEW_OTP_LENGTH}-digit code sent to your email` }, { status: 400 });
    }

    if (!checkRateLimit(`review-otp-verify-ip:${getIp(req.headers)}`, 30, 10 * 60)) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
    }

    const db = getServerSupabase();
    const { data: otpRow, error: otpErr } = await db
      .from('event_review_otps')
      .select('id, otp_hash, expires_at, attempts')
      .eq('email', normalized)
      .eq('event_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (otpErr) {
      console.error('review OTP lookup error', otpErr);
      return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
    }

    // "No code on file" (not a buyer / never requested) reads the same as an
    // expired one — verify must not become a buyer-existence oracle either.
    const INVALID = NextResponse.json({ error: 'That code is incorrect or has expired. Request a new one.' }, { status: 400 });
    if (!otpRow) return INVALID;
    if (new Date(otpRow.expires_at) < new Date()) {
      await db.from('event_review_otps').delete().eq('id', otpRow.id);
      return INVALID;
    }
    if (otpRow.attempts >= REVIEW_OTP_MAX_ATTEMPTS) {
      await db.from('event_review_otps').delete().eq('id', otpRow.id);
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 });
    }

    const expected = Buffer.from(otpRow.otp_hash);
    const actual = Buffer.from(hashReviewOTP(submitted, normalized, id));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const attempts = otpRow.attempts + 1;
      await db.from('event_review_otps').update({ attempts }).eq('id', otpRow.id);
      const left = REVIEW_OTP_MAX_ATTEMPTS - attempts;
      return NextResponse.json(
        { error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.' },
        { status: 400 },
      );
    }

    await db.from('event_review_otps').delete().eq('id', otpRow.id);
    return NextResponse.json({ success: true, data: { reviewToken: signReviewToken(normalized, id) } });
  } catch (err) {
    console.error('POST /api/events/[id]/review-verify error', err);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
