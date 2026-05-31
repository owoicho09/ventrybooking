import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyPassword, hashPassword } from '@/lib/server/password';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data } = await db.from('users').select('password_hash').eq('id', user.sub).single();
    if (!data || !verifyPassword(currentPassword, data.password_hash)) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newHash = hashPassword(newPassword);
    await db.from('users').update({ password_hash: newHash }).eq('id', user.sub);
    return NextResponse.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch (err) {
    console.error('change-password error', err);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
