import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/server/password';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`aff-login:${getIp(req.headers)}`, 10, 15 * 60)) {
    return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: affiliate } = await db
      .from('platform_affiliates')
      .select('id, name, email, password_hash, referral_code')
      .eq('email', email)
      .maybeSingle();

    if (!affiliate || !verifyPassword(password, affiliate.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signAuthToken({ sub: affiliate.id, role: 'affiliate', email: affiliate.email });
    const res = NextResponse.json({
      success: true,
      data: { id: affiliate.id, name: affiliate.name, email: affiliate.email, referralCode: affiliate.referral_code },
    });
    res.cookies.set({ ...cookieOptions(30 * 24 * 60 * 60), value: token });
    return res;
  } catch (err) {
    console.error('affiliate login error', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
