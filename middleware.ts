import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ORGANIZER_LOGIN = '/organizer/login';
const ADMIN_LOGIN = '/admin/login';

const ORGANIZER_AUTH_PATHS = [
  '/organizer/login',
  '/organizer/register',
  '/organizer/verify',
  '/organizer/forgot-password',
  '/organizer/reset-password',
];

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function verifyToken(token: string): Promise<{ role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { role: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('ventry_token')?.value;

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
    return NextResponse.next();
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
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/organizer/:path*', '/admin/:path*'],
};
