import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/server/password';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';
import { createHash, randomInt } from 'crypto';
import { sendOTPEmail } from '@/lib/server/email';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, confirmPassword } = await req.json();

    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const db = getServerSupabase();

    const { data: existing } = await db.from('users').select('id').eq('email', email).single();
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    const { data: user, error } = await db
      .from('users')
      .insert({
        name,
        email,
        phone,
        password_hash: passwordHash,
        tier: 'Standard',
        verified: false,
        member_since: now.split('T')[0],
        events_hosted: 0,
        kyc_status: 'pending',
        email_notifications: true,
        sms_alerts: false,
        created_at: now,
      })
      .select('id, email, name')
      .single();

    if (error) throw error;

    // Generate email OTP and store hash
    const otp = randomInt(100000, 999999).toString();
    const otpHash = createHash('sha256').update(otp + user.id).digest('hex');
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.from('users').update({ email_otp: otpHash, email_otp_expires_at: otpExpiresAt }).eq('id', user.id);
    try {
      await sendOTPEmail(user.email, user.name, otp);
    } catch (emailErr) {
      console.error('OTP email failed on register:', emailErr);
      // Account is created; organizer can request a new code from the verify page
    }

    const token = signAuthToken({ sub: user.id, role: 'organizer', email: user.email });
    const res = NextResponse.json({ success: true, data: { id: user.id, name: user.name, email: user.email } });
    res.cookies.set({ ...cookieOptions(7 * 24 * 60 * 60), value: token });
    return res;
  } catch (err) {
    console.error('register error', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
