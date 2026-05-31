import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { signResetToken } from '@/lib/server/jwt';
import { sendPasswordResetEmail } from '@/lib/server/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const db = getServerSupabase();
    const { data: user } = await db.from('users').select('id').eq('email', email).single();

    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({ success: true, data: { message: 'If this email is registered, a reset link has been sent.' } });
    }

    const token = signResetToken(email);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.from('reset_tokens').insert({ email, token, expires_at: expiresAt });
    await sendPasswordResetEmail(email, token);

    return NextResponse.json({ success: true, data: { message: 'If this email is registered, a reset link has been sent.' } });
  } catch (err) {
    console.error('forgot-password error', err);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}
