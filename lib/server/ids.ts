import { randomBytes } from 'crypto';

function randomAlphaNum(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generateTicketId(): string {
  return `TKT-${randomAlphaNum(4)}-${randomAlphaNum(4)}`;
}

export function generateRefundCode(): string {
  return `RF-${randomAlphaNum(4)}-${randomAlphaNum(2)}`;
}

export function generatePayoutRef(): string {
  const year = new Date().getFullYear();
  return `VTR-PAY-${year}-${randomAlphaNum(6)}`;
}

/** Short door-staff access code: STF-XXXX-XXXX */
export function generateStaffCode(): string {
  return `STF-${randomAlphaNum(4)}-${randomAlphaNum(4)}`;
}

/** Affiliate ref code carried in event link query params: AFF-XXXXXXXX */
export function generateAffiliateCode(): string {
  return `AFF-${randomAlphaNum(8)}`;
}

/**
 * Ventry-wide platform affiliate referral code: REF-XXXXXXXX. Deliberately a
 * different prefix from generateAffiliateCode() (AFF-...) — that one is the
 * existing organiser-created per-event marketer link, a different feature
 * from the platform-level affiliate program this belongs to.
 */
export function generatePlatformReferralCode(): string {
  return `REF-${randomAlphaNum(8)}`;
}
