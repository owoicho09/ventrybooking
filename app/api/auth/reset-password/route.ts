import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyResetToken } from '@/lib/server/jwt';
import { hashPassword } from '@/lib/server/password';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    let email: string;
    try {
      email = verifyResetToken(token).email;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: resetRecord } = await db
      .from('reset_tokens')
      .select('id, used, expires_at')
      .eq('token', token)
      .eq('email', email)
      .single();

    if (!resetRecord || resetRecord.used || new Date(resetRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    await db.from('users').update({ password_hash: passwordHash }).eq('email', email);
    await db.from('reset_tokens').update({ used: true }).eq('id', resetRecord.id);

    return NextResponse.json({ success: true, data: { message: 'Password updated successfully' } });
  } catch (err) {
    console.error('reset-password error', err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
