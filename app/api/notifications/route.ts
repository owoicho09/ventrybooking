import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// Returns the 20 most recent notifications + unread count for the current user.
// Admin sees all admin-type notifications; organizers see their own.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServerSupabase();

  let query = db
    .from('notifications')
    .select('id, type, title, body, link, read, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (user.role === 'admin') {
    query = query.eq('recipient_type', 'admin');
  } else if (user.role === 'organizer') {
    query = query.eq('recipient_type', 'organizer').eq('recipient_id', user.sub);
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });

  const unread = (data ?? []).filter(n => !n.read).length;
  return NextResponse.json({ success: true, data: { notifications: data ?? [], unread } });
}

// Mark all as read for the current user
export async function PATCH() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServerSupabase();

  let query = db.from('notifications').update({ read: true }).eq('read', false);

  if (user.role === 'admin') {
    query = query.eq('recipient_type', 'admin');
  } else if (user.role === 'organizer') {
    query = query.eq('recipient_type', 'organizer').eq('recipient_id', user.sub);
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await query;
  return NextResponse.json({ success: true });
}
