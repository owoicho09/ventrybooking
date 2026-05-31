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
