import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET!;

export interface AuthPayload {
  sub: string;
  role: 'organizer' | 'admin' | 'affiliate' | 'buyer';
  email: string;
}

export interface QrPayload {
  ticketId: string;
  eventId: string;
}

export function signAuthToken(payload: AuthPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

export function verifyAuthToken(token: string): AuthPayload {
  return jwt.verify(token, SECRET) as AuthPayload;
}

export function signQrToken(payload: QrPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '365d' });
}

export function verifyQrToken(token: string): QrPayload {
  return jwt.verify(token, SECRET) as QrPayload;
}

/** Which account table a password reset applies to. */
export type ResetAccount = 'organizer' | 'affiliate';

export function signResetToken(email: string, account: ResetAccount = 'organizer'): string {
  return jwt.sign({ email, account }, SECRET, { expiresIn: '1h' });
}

/** Tokens issued before `account` existed are organiser resets. */
export function verifyResetToken(token: string): { email: string; account: ResetAccount } {
  const p = jwt.verify(token, SECRET) as { email: string; account?: string };
  return { email: p.email, account: p.account === 'affiliate' ? 'affiliate' : 'organizer' };
}
