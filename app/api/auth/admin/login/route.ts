import { NextRequest, NextResponse } from 'next/server';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';

export async function POST(req: NextRequest) {
  // 5 attempts per 15 minutes per IP — tighter limit for admin
  if (!checkRateLimit(`admin-login:${getIp(req.headers)}`, 5, 15 * 60)) {
    return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
  }

  try {
    const { email, password } = await req.json();

    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signAuthToken({ sub: 'admin', role: 'admin', email });
    const res = NextResponse.json({ success: true, data: { role: 'admin' } });
    res.cookies.set({ ...cookieOptions(30 * 24 * 60 * 60), value: token });
    return res;
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
