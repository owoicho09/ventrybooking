import { cookies } from 'next/headers';
import { verifyAuthToken, type AuthPayload } from './jwt';

// Separate cookie from the organizer/admin/affiliate session (ventry_token)
// so a buyer and an organizer can be signed in at once in the same browser
// without one session clobbering the other.
const COOKIE_NAME = 'ventry_buyer_token';

export async function getBuyerAuthCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value;
}

export async function getBuyerAuth(): Promise<AuthPayload | null> {
  const token = await getBuyerAuthCookie();
  if (!token) return null;
  try {
    const payload = verifyAuthToken(token);
    return payload.role === 'buyer' ? payload : null;
  } catch {
    return null;
  }
}

export function buyerCookieOptions(maxAge: number) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
