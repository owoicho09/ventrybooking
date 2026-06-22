import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET!;

export interface AuthPayload {
  sub: string;
  role: 'organizer' | 'admin';
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

export function signResetToken(email: string): string {
  return jwt.sign({ email }, SECRET, { expiresIn: '1h' });
}

export function verifyResetToken(token: string): { email: string } {
  return jwt.verify(token, SECRET) as { email: string };
}
