import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { sendReviewOTPEmail } from '@/lib/server/email';
import { isUUID } from '@/lib/slug';
import { isPlausibleEmail, normalizeCheckoutEmail } from '@/lib/server/checkoutEmailVerification';
import {
  REVIEW_OTP_LENGTH,
  REVIEW_OTP_RESEND_COOLDOWN_SECONDS,
  REVIEW_OTP_TTL_MS,
  getReviewEligibility,
  hashReviewOTP,
} from '@/lib/server/eventReviews';

const GENERIC_MESSAGE = 'If that email was used to buy a ticket for this event, a code is on its way.';

// Sends a review code to the typed email — but only if it is genuinely a
// buyer of this event who hasn't reviewed yet. The response is identical
// either way (and inside the resend cooldown), otherwise this endpoint would
// let anyone probe whether an email holds a ticket to an event.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { email } = await req.json().catch(() => ({}));
    const normalized = normalizeCheckoutEmail(email);
    if (!isUUID(id)) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (!isPlausibleEmail(normalized)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const ip = getIp(req.headers);
    if (
      !checkRateLimit(`review-otp-send:${id}:${normalized}`, 5, 10 * 60) ||
      !checkRateLimit(`review-otp-send-ip:${ip}`, 15, 10 * 60)
    ) {
      return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
    }

    const db = getServerSupabase();
    const { data: event } = await db.from('events').select('id, event_name, status').eq('id', id).maybeSingle();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.status !== 'completed') {
      return NextResponse.json({ error: 'Reviews open once the event has ended.' }, { status: 403 });
    }

    const ok = NextResponse.json({
      success: true,
      data: { message: GENERIC_MESSAGE, cooldownSeconds: REVIEW_OTP_RESEND_COOLDOWN_SECONDS, codeLength: REVIEW_OTP_LENGTH },
    });

    const { tickets, alreadyReviewed } = await getReviewEligibility(db, id, normalized);
    if (tickets.length === 0 || alreadyReviewed) return ok;

    // Silent cooldown: skip re-sending inside the window rather than 429, so
    // the response shape can't reveal that this email has a code outstanding.
    const { data: latest } = await db
      .from('event_review_otps')
      .select('created_at')
      .eq('email', normalized)
      .eq('event_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest && Date.now() - new Date(latest.created_at).getTime() < REVIEW_OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      return ok;
    }

    const otp = randomInt(0, 10 ** REVIEW_OTP_LENGTH).toString().padStart(REVIEW_OTP_LENGTH, '0');
    await db.from('event_review_otps').delete().eq('email', normalized).eq('event_id', id);
    const { data: inserted, error: insertErr } = await db
      .from('event_review_otps')
      .insert({
        email: normalized,
        event_id: id,
        otp_hash: hashReviewOTP(otp, normalized, id),
        expires_at: new Date(Date.now() + REVIEW_OTP_TTL_MS).toISOString(),
      })
      .select('id')
      .single();
    if (insertErr || !inserted) {
      console.error('review OTP insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to send the code. Please try again.' }, { status: 500 });
    }

    try {
      await sendReviewOTPEmail(normalized, event.event_name, otp);
    } catch (emailErr) {
      // Not surfaced to the caller (that would reveal this email is a buyer);
      // dropping the row lets an immediate retry through instead of being
      // held by the cooldown.
      console.error('review OTP email failed:', emailErr);
      await db.from('event_review_otps').delete().eq('id', inserted.id);
    }

    return ok;
  } catch (err) {
    console.error('POST /api/events/[id]/review-code error', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
