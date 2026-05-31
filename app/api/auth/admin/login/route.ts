import { NextRequest, NextResponse } from 'next/server';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';

export async function POST(req: NextRequest) {
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
    res.cookies.set({ ...cookieOptions(24 * 60 * 60), value: token });
    return res;
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
