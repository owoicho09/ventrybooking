import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/server/password';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { isTrustedDevice, createLoginChallenge, describeDevice } from '@/lib/server/trustedDevice';
import { sendLoginCodeEmail } from '@/lib/server/email';
import { maskEmail } from '@/lib/server/settingsChange';

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
      .select('id, email, name, password_hash, kyc_status, verified, email_verified')
      .eq('email', email)
      .single();

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // New-device check (057): the right password on a browser this organiser
    // hasn't confirmed before creates no session. An emailed code finishes the
    // sign-in at /api/auth/organizer/login/verify.
    if (!(await isTrustedDevice(db, user.id, req))) {
      const challenge = await createLoginChallenge(db, user.id, req);
      if (!challenge.ok) return NextResponse.json({ error: challenge.error }, { status: challenge.status });
      try {
        await sendLoginCodeEmail(user.email, user.name ?? 'there', challenge.code, describeDevice(req.headers.get('user-agent')));
      } catch (err) {
        console.error('login code email failed', err);
        return NextResponse.json({ error: 'We couldn’t email your sign-in code. Try again in a moment.' }, { status: 502 });
      }
      return NextResponse.json({
        success: true,
        data: { needsDeviceCode: true, challengeId: challenge.challengeId, sentTo: maskEmail(user.email) },
      });
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
        emailVerified: user.email_verified,
      },
    });
    res.cookies.set({ ...cookieOptions(30 * 24 * 60 * 60), value: token });
    return res;
  } catch (err) {
    console.error('login error', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
