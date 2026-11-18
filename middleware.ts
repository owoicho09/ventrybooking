import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';

const ORGANIZER_LOGIN = '/organizer/login';
const ADMIN_LOGIN = '/admin/login';
const AFFILIATE_LOGIN = '/affiliate/login';
const BUYER_LOGIN = '/signin';

const ORGANIZER_AUTH_PATHS = [
  '/organizer/login',
  '/organizer/register',
  '/organizer/forgot-password',
  '/organizer/reset-password',
];

const AFFILIATE_AUTH_PATHS = [
  '/affiliate/login',
  '/affiliate/register',
  '/affiliate/forgot-password',
  '/affiliate/reset-password',
];

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function verifyToken(token: string): Promise<({ role: string } & JWTPayload) | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { role: string } & JWTPayload;
  } catch {
    return null;
  }
}

// Sessions roll: every signed-in page visit more than a day after the token
// was issued swaps in a fresh 30-day one, so people who use the dashboard
// are never signed out mid-task. Only an idle 30 days ends a session.
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_AFTER_SECONDS = 24 * 60 * 60;

async function withRefreshedSession(res: NextResponse, payload: { role: string } & JWTPayload) {
  const now = Math.floor(Date.now() / 1000);
  if (!payload.iat || now - payload.iat < REFRESH_AFTER_SECONDS) return res;
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return res;
  try {
    const token = await new SignJWT({ sub: payload.sub, role: payload.role, email: payload.email })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(now + SESSION_SECONDS)
      .sign(SECRET);
    // Same attributes as lib/server/auth.ts cookieOptions.
    res.cookies.set({
      name: 'ventry_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_SECONDS,
    });
  } catch { /* keep the existing session */ }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('ventry_token')?.value;

  // Unified buyer/organiser/affiliate entry — redirect away if already
  // signed in as a buyer, same as the org/affiliate auth-page pattern below.
  if (pathname === BUYER_LOGIN) {
    const buyerToken = req.cookies.get('ventry_buyer_token')?.value;
    if (buyerToken) {
      const payload = await verifyToken(buyerToken);
      if (payload?.role === 'buyer') {
        return NextResponse.redirect(new URL('/account', req.url));
      }
    }
    return NextResponse.next();
  }

  // Buyer account routes — separate cookie (ventry_buyer_token) from the
  // organizer/admin/affiliate session above, so the two never collide.
  if (pathname.startsWith('/account')) {
    const buyerToken = req.cookies.get('ventry_buyer_token')?.value;

    if (!buyerToken) {
      return NextResponse.redirect(new URL(BUYER_LOGIN, req.url));
    }
    const payload = await verifyToken(buyerToken);
    if (!payload || payload.role !== 'buyer') {
      return NextResponse.redirect(new URL(BUYER_LOGIN, req.url));
    }
    return NextResponse.next();
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (pathname === ADMIN_LOGIN) return NextResponse.next();

    if (!token) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN, req.url));
    }
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.redirect(new URL(ADMIN_LOGIN, req.url));
    }
    return withRefreshedSession(NextResponse.next(), payload);
  }

  // Organizer routes
  if (pathname.startsWith('/organizer')) {
    const isAuthPage = ORGANIZER_AUTH_PATHS.some((p) => pathname.startsWith(p));

    if (isAuthPage) {
      if (token) {
        const payload = await verifyToken(token);
        if (payload?.role === 'organizer') {
          return NextResponse.redirect(new URL('/organizer/dashboard', req.url));
        }
      }
      return NextResponse.next();
    }

    // Protected organizer page
    if (!token) {
      return NextResponse.redirect(new URL(ORGANIZER_LOGIN, req.url));
    }
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'organizer') {
      return NextResponse.redirect(new URL(ORGANIZER_LOGIN, req.url));
    }
    return withRefreshedSession(NextResponse.next(), payload);
  }

  // Affiliate routes
  if (pathname.startsWith('/affiliate')) {
    const isAuthPage = AFFILIATE_AUTH_PATHS.some((p) => pathname.startsWith(p));

    if (isAuthPage) {
      if (token) {
        const payload = await verifyToken(token);
        if (payload?.role === 'affiliate') {
          return NextResponse.redirect(new URL('/affiliate/dashboard', req.url));
        }
      }
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.redirect(new URL(AFFILIATE_LOGIN, req.url));
    }
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'affiliate') {
      return NextResponse.redirect(new URL(AFFILIATE_LOGIN, req.url));
    }
    return withRefreshedSession(NextResponse.next(), payload);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/organizer/:path*', '/admin/:path*', '/affiliate/:path*', '/account/:path*', '/signin'],
};
