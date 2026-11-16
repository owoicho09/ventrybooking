import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { verifyLoginChallenge, trustDevice, describeDevice } from '@/lib/server/trustedDevice';
import { sendNewSignInAlertEmail } from '@/lib/server/email';

/**
 * Second step of signing in on a new device (057): the emailed code. On
 * success the session starts, this browser becomes trusted, and the
 * organiser gets a "new sign-in" alert.
 */
export async function POST(req: NextRequest) {
  if (!checkRateLimit(`org-login-verify:${getIp(req.headers)}`, 20, 15 * 60)) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }
  try {
    const { challengeId, code } = await req.json().catch(() => ({})) as { challengeId?: unknown; code?: unknown };
    const db = getServerSupabase();
    const checked = await verifyLoginChallenge(db, challengeId, code);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status });

    const { data: user } = await db
      .from('users')
      .select('id, email, name, kyc_status, verified, email_verified')
      .eq('id', checked.userId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

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
    res.cookies.set({ ...cookieOptions(30 * 24 * 60 * 60), value: signAuthToken({ sub: user.id, role: 'organizer', email: user.email }) });
    await trustDevice(db, user.id, req, res);

    const when = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' });
    sendNewSignInAlertEmail(user.email, user.name ?? 'there', checked.label ?? describeDevice(req.headers.get('user-agent')), when)
      .catch(err => console.error('new sign-in alert error', err));

    return res;
  } catch (err) {
    console.error('login verify error', err);
    return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 });
  }
}
