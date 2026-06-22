import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/server/password';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';

export async function POST(req: NextRequest) {
  // 10 attempts per 15 minutes per IP
  if (!checkRateLimit(`org-login:${getIp(req.headers)}`, 10, 15 * 60)) {
    return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: user } = await db
      .from('users')
      .select('id, email, name, password_hash, kyc_status, verified')
      .eq('email', email)
      .single();

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signAuthToken({ sub: user.id, role: 'organizer', email: user.email });
    const res = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        kycStatus: user.kyc_status,
        verified: user.verified,
      },
    });
    res.cookies.set({ ...cookieOptions(30 * 24 * 60 * 60), value: token });
    return res;
  } catch (err) {
    console.error('login error', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
