import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// Mark a single notification as read. Scoped to the authenticated user so
// one user cannot mark another user's notifications as read.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getServerSupabase();

  let query = db.from('notifications').update({ read: true }).eq('id', id);

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
