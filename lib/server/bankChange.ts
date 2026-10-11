import { createHash } from 'crypto';

/** Hash for the one-time code that confirms a payout bank change (Organiser Terms 3.8). */
export function hashBankOTP(otp: string, userId: string): string {
  return createHash('sha256').update(`bank:${otp}:${userId}`).digest('hex');
}
