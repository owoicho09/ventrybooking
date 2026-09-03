import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/server/password';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';
import { generatePlatformReferralCode } from '@/lib/server/ids';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, confirmPassword } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const db = getServerSupabase();

    const { data: existing } = await db.from('platform_affiliates').select('id').eq('email', email).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'An affiliate account with this email already exists' }, { status: 409 });
    }

    // Referral codes collide astronomically rarely (8 base-36 chars), but a
    // unique constraint backs this up regardless — retry once on conflict.
    let code = generatePlatformReferralCode();
    let affiliate;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await db
        .from('platform_affiliates')
        .insert({ name, email, password_hash: hashPassword(password), referral_code: code })
        .select('id, name, email, referral_code')
        .single();
      if (!error) { affiliate = data; break; }
      if (error.code !== '23505') throw error;
      code = generatePlatformReferralCode();
    }
    if (!affiliate) {
      return NextResponse.json({ error: 'Could not generate a referral code — please try again' }, { status: 500 });
    }

    const token = signAuthToken({ sub: affiliate.id, role: 'affiliate', email: affiliate.email });
    const res = NextResponse.json({
      success: true,
      data: { id: affiliate.id, name: affiliate.name, email: affiliate.email, referralCode: affiliate.referral_code },
    });
    res.cookies.set({ ...cookieOptions(30 * 24 * 60 * 60), value: token });
    return res;
  } catch (err) {
    console.error('affiliate register error', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
