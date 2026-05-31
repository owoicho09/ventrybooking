import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/server/password';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: user } = await db
      .from('users')
      .select('id, email, name, password_hash, kyc_status')
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
      },
    });
    res.cookies.set({ ...cookieOptions(7 * 24 * 60 * 60), value: token });
    return res;
  } catch (err) {
    console.error('login error', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
