import { cookies } from 'next/headers';
import { verifyAuthToken, type AuthPayload } from './jwt';

const COOKIE_NAME = 'ventry_token';

export async function getAuthCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value;
}

export async function getAuthUser(): Promise<AuthPayload | null> {
  const token = await getAuthCookie();
  if (!token) return null;
  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
