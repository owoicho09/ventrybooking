import jwt from 'jsonwebtoken';
import { createHmac } from 'crypto';
import { getBuyerAuth } from '@/lib/server/buyerAuth';

const SECRET = process.env.JWT_SECRET!;

export const CHECKOUT_OTP_LENGTH = 6;
export const CHECKOUT_OTP_TTL_MS = 10 * 60 * 1000;
export const CHECKOUT_OTP_MAX_ATTEMPTS = 5;
export const CHECKOUT_OTP_RESEND_COOLDOWN_SECONDS = 60;
// Long enough to finish paying, short enough that a stolen token is useless.
const VERIFIED_TOKEN_TTL_SECONDS = 30 * 60;

export const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED';

export function normalizeCheckoutEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Keyed with the server secret so a leaked otp_hash row can't be brute-forced
// offline (a 6-digit space is otherwise trivially enumerable from a bare hash).
export function hashCheckoutOTP(otp: string, email: string): string {
  return createHmac('sha256', SECRET).update(`${email}:${otp}`).digest('hex');
}

export function signCheckoutEmailToken(email: string): string {
  return jwt.sign({ purpose: 'checkout_email', email }, SECRET, { expiresIn: VERIFIED_TOKEN_TTL_SECONDS });
}

/**
 * Server-side gate for both checkout routes — the UI step alone would be
 * trivially skippable by calling the API directly.
 *
 * A signed-in buyer skips the code: their account was created by proving
 * inbox access, and any ticket bought for someone else's email is still
 * surfaced in their own /account (purchased_by_email), so a typo'd gift can't
 * strand it. Guests must present a token issued by the verify route for this
 * exact email.
 */
export async function isCheckoutEmailVerified(email: unknown, token: unknown): Promise<boolean> {
  if (await getBuyerAuth()) return true;

  const normalized = normalizeCheckoutEmail(email);
  if (!normalized || typeof token !== 'string' || !token) return false;
  try {
    const payload = jwt.verify(token, SECRET) as { purpose?: string; email?: string };
    return payload.purpose === 'checkout_email' && payload.email === normalized;
  } catch {
    return false;
  }
}
