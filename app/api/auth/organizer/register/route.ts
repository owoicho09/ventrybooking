import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/server/password';
import { signAuthToken } from '@/lib/server/jwt';
import { cookieOptions } from '@/lib/server/auth';
import { createHash, randomInt } from 'crypto';
import { sendOTPEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, confirmPassword, referralCode, termsVersion } = await req.json();

    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (!termsVersion) {
      return NextResponse.json({ error: 'You must agree to the Organiser Terms' }, { status: 400 });
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
        terms_version: String(termsVersion),
        terms_accepted_at: now,
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

    notify(
      { type: 'admin' },
      {
        notifType: 'kyc',
        title:     'New Organizer Registered',
        body:      `${name} (${email}) has registered and is pending email verification.`,
        link:      '/admin/organizers',
      },
      { emailChannel: 'immediate' },
    ).catch(console.error);

    // Affiliate attribution — first-touch only, resolved once, right now.
    // Preferred source is the cookie set by an earlier ?aff=CODE page visit
    // (see AffiliateAttributionCapture); if there is none, fall back to a
    // code the organiser typed in manually — covers referrals that happened
    // by word of mouth rather than a clicked link. Either way this only ever
    // runs once, right now — nothing here can be re-attributed later.
    const refCode = req.cookies.get('ventry_aff')?.value || (typeof referralCode === 'string' ? referralCode.trim() : '');
    if (refCode) {
      const { data: affiliate } = await db
        .from('platform_affiliates')
        .select('id, email')
        .eq('referral_code', refCode)
        .maybeSingle();
      // Guard against the most obvious gaming: an affiliate can't credit themselves.
      if (affiliate && affiliate.email.toLowerCase() !== user.email.toLowerCase()) {
        const { error: refErr } = await db
          .from('platform_affiliate_referrals')
          .insert({ affiliate_id: affiliate.id, organizer_id: user.id });
        if (refErr && refErr.code !== '23505') {
          console.error('register: affiliate referral insert error', refErr);
        }
      }
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
