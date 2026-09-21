import jwt from 'jsonwebtoken';
import { createHmac } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const SECRET = process.env.JWT_SECRET!;

export const REVIEW_OTP_LENGTH = 6;
export const REVIEW_OTP_TTL_MS = 10 * 60 * 1000;
export const REVIEW_OTP_MAX_ATTEMPTS = 5;
export const REVIEW_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const REVIEW_MAX_BODY_LENGTH = 500;
// Long enough to write a thoughtful review, short enough that a stolen token is useless.
const REVIEW_TOKEN_TTL_SECONDS = 30 * 60;

// Scoped to the event as well as the email so a code issued for one event can
// never be replayed against another, and keyed with the server secret so a
// leaked otp_hash row can't be brute-forced offline.
export function hashReviewOTP(otp: string, email: string, eventId: string): string {
  return createHmac('sha256', SECRET).update(`review:${eventId}:${email}:${otp}`).digest('hex');
}

export function signReviewToken(email: string, eventId: string): string {
  return jwt.sign({ purpose: 'event_review', email, eventId }, SECRET, { expiresIn: REVIEW_TOKEN_TTL_SECONDS });
}

/** Returns the verified email if the token is a valid review token for exactly this event, else null. */
export function verifyReviewToken(token: unknown, eventId: string): string | null {
  if (typeof token !== 'string' || !token) return null;
  try {
    const p = jwt.verify(token, SECRET) as { purpose?: string; email?: string; eventId?: string };
    return p.purpose === 'event_review' && p.eventId === eventId && p.email ? p.email : null;
  } catch {
    return null;
  }
}

/**
 * What a review shows as its author. A free ticket bought without a name is
 * stored with the buyer's *email* as buyer_name, which must never be printed
 * on a public page.
 */
export function publicReviewName(buyerName: string | null | undefined): string {
  const name = buyerName?.trim();
  if (!name || name.includes('@')) return 'Verified Attendee';
  return name;
}

export interface ReviewEligibility {
  /** This email's non-refunded tickets for the event, earliest purchase first. */
  tickets: { id: string; buyer_name: string | null }[];
  /** True once any of those tickets already carries a review — one review per person per event. */
  alreadyReviewed: boolean;
}

/**
 * A buyer is anyone whose email is recorded against a valid (or checked-in)
 * ticket for the event — attendance isn't required, matching "bought a
 * ticket". A refunded ticket doesn't count.
 */
export async function getReviewEligibility(
  db: SupabaseClient,
  eventId: string,
  email: string,
): Promise<ReviewEligibility> {
  // ilike treats % and _ as wildcards and both are legal in an email address:
  // unescaped, "a_b@gmail.com" (an inbox the requester really owns and gets
  // the code in) would also match the buyer "axb@gmail.com" and let them
  // review as that buyer. Escape so it's a case-insensitive *equality* match.
  const exactPattern = email.replace(/[\\%_]/g, m => `\\${m}`);

  const { data: tickets } = await db
    .from('tickets')
    .select('id, buyer_name')
    .eq('event_id', eventId)
    .ilike('buyer_email', exactPattern)
    .in('status', ['valid', 'used'])
    .order('purchased_at', { ascending: true });

  const rows = tickets ?? [];
  if (rows.length === 0) return { tickets: [], alreadyReviewed: false };

  const { count } = await db
    .from('event_reviews')
    .select('id', { count: 'exact', head: true })
    .in('ticket_id', rows.map(t => t.id));

  return { tickets: rows, alreadyReviewed: (count ?? 0) > 0 };
}
