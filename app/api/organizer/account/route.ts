import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/server/password';

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { password } = await req.json() as { password?: string };
    if (!password) {
      return NextResponse.json({ error: 'Password is required to confirm deletion' }, { status: 400 });
    }

    const db = getServerSupabase();

    // Verify password before deleting
    const { data: userData } = await db
      .from('users')
      .select('password_hash')
      .eq('id', user.sub)
      .single();

    if (!userData || !verifyPassword(password, userData.password_hash)) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
    }

    // Block deletion if they have active events with sold tickets
    const { data: activeEvents } = await db
      .from('events')
      .select('id')
      .eq('organizer_id', user.sub)
      .in('status', ['approved', 'under_review'])
      .limit(1);

    if (activeEvents && activeEvents.length > 0) {
      return NextResponse.json({
        error: 'You have active or pending events. Cancel or complete them before deleting your account.',
      }, { status: 400 });
    }

    // Delete the user — DB cascade handles related rows
    await db.from('users').delete().eq('id', user.sub);

    // Clear auth cookie
    const res = NextResponse.json({ success: true });
    res.cookies.set({
      name: 'ventry_token',
      value: '',
      httpOnly: true,
      maxAge: 0,
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('DELETE /api/organizer/account error', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
