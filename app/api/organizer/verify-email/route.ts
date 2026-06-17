import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { createHash, randomInt } from 'crypto';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { sendOTPEmail } from '@/lib/server/email';

function hashOTP(otp: string, userId: string): string {
  return createHash('sha256').update(otp + userId).digest('hex');
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const db = getServerSupabase();

  if (body.action === 'resend') {
    if (!checkRateLimit(`otp-send:${user.sub}`, 3, 10 * 60)) {
      return NextResponse.json({ error: 'Too many resend attempts. Please wait a few minutes.' }, { status: 429 });
    }

    const { data: userRow } = await db.from('users').select('email, name, verified').eq('id', user.sub).single();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (userRow.verified) return NextResponse.json({ success: true });

    const otp = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.from('users').update({ email_otp: hashOTP(otp, user.sub), email_otp_expires_at: expiresAt }).eq('id', user.sub);

    try {
      await sendOTPEmail(userRow.email, userRow.name, otp);
    } catch (emailErr) {
      console.error('OTP resend email failed:', emailErr);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (body.action === 'verify') {
    if (!checkRateLimit(`otp-verify:${user.sub}:${getIp(req.headers)}`, 5, 10 * 60)) {
      return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
    }

    const submitted = String(body.otp ?? '').trim();
    if (!/^\d{6}$/.test(submitted)) {
      return NextResponse.json({ error: 'Enter a valid 6-digit code' }, { status: 400 });
    }

    const { data: userRow, error: dbErr } = await db
      .from('users')
      .select('email_otp, email_otp_expires_at, verified')
      .eq('id', user.sub)
      .single();

    if (dbErr) {
      console.error('verify-email db error:', dbErr.message);
      return NextResponse.json({ error: 'Database error: ' + dbErr.message }, { status: 500 });
    }
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (userRow.verified) return NextResponse.json({ success: true, data: { verified: true } });

    if (!userRow.email_otp || !userRow.email_otp_expires_at) {
      return NextResponse.json({ error: 'No verification code found. Request a new one.' }, { status: 400 });
    }

    if (new Date(userRow.email_otp_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code has expired. Request a new one.' }, { status: 400 });
    }

    if (hashOTP(submitted, user.sub) !== userRow.email_otp) {
      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
    }

    await db.from('users').update({
      verified: true,
      kyc_status: 'approved',
      email_otp: null,
      email_otp_expires_at: null,
    }).eq('id', user.sub);

    return NextResponse.json({ success: true, data: { verified: true } });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
