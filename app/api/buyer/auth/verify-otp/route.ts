import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { signAuthToken } from '@/lib/server/jwt';
import { buyerCookieOptions } from '@/lib/server/buyerAuth';

function hashOTP(otp: string, email: string): string {
  return createHash('sha256').update(otp + email).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();
    const normalized = String(email ?? '').trim().toLowerCase();
    const submitted = String(otp ?? '').trim();

    if (!normalized || !/^\d{4}$/.test(submitted)) {
      return NextResponse.json({ error: 'Enter the 4-digit code sent to your email' }, { status: 400 });
    }

    const ip = getIp(req.headers);
    if (
      !checkRateLimit(`buyer-otp-verify:${normalized}`, 5, 10 * 60) ||
      !checkRateLimit(`buyer-otp-verify-ip:${ip}`, 15, 10 * 60)
    ) {
      return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
    }

    const db = getServerSupabase();
    const { data: otpRow, error: otpErr } = await db
      .from('buyer_login_otps')
      .select('id, otp_hash, expires_at')
      .eq('email', normalized)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpErr) {
      console.error('buyer verify-otp lookup error', otpErr);
      return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
    }

    const INVALID = NextResponse.json({ error: 'Incorrect or expired code. Request a new one.' }, { status: 400 });

    if (!otpRow) return INVALID;
    if (new Date(otpRow.expires_at) < new Date()) {
      await db.from('buyer_login_otps').delete().eq('id', otpRow.id);
      return INVALID;
    }
    if (hashOTP(submitted, normalized) !== otpRow.otp_hash) {
      return INVALID;
    }

    // Single-use — burn it immediately on success so it can't be replayed.
    await db.from('buyer_login_otps').delete().eq('id', otpRow.id);

    const token = signAuthToken({ sub: normalized, role: 'buyer', email: normalized });
    const res = NextResponse.json({ success: true, data: { email: normalized } });
    res.cookies.set({ ...buyerCookieOptions(30 * 24 * 60 * 60), value: token });
    return res;
  } catch (err) {
    console.error('POST /api/buyer/auth/verify-otp error', err);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
