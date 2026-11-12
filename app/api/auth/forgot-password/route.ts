import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { signResetToken, type ResetAccount } from '@/lib/server/jwt';
import { sendPasswordResetEmail } from '@/lib/server/email';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';

// Organiser accounts live in `users`, affiliate accounts in `platform_affiliates`.
const ACCOUNT_TABLE: Record<ResetAccount, string> = {
  organizer: 'users',
  affiliate: 'platform_affiliates',
};

const GENERIC = { success: true, data: { message: 'If this email is registered, a reset link has been sent.' } };

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`forgot-pw:${getIp(req.headers)}`, 5, 15 * 60)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const account: ResetAccount = body.account === 'affiliate' ? 'affiliate' : 'organizer';
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const db = getServerSupabase();
    const { data: user } = await db.from(ACCOUNT_TABLE[account]).select('id').eq('email', email).maybeSingle();

    // Always return success to avoid email enumeration
    if (!user) return NextResponse.json(GENERIC);

    const token = signResetToken(email, account);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.from('reset_tokens').insert({ email, token, expires_at: expiresAt });
    await sendPasswordResetEmail(email, token, account);

    return NextResponse.json(GENERIC);
  } catch (err) {
    console.error('forgot-password error', err);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}
