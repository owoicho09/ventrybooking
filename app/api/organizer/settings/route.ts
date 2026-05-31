import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const allowed = ['name', 'phone', 'bio', 'email_notifications', 'sms_alerts'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const db = getServerSupabase();
    await db.from('users').update(updates).eq('id', user.sub);
    return NextResponse.json({ success: true, data: { message: 'Settings updated' } });
  } catch (err) {
    console.error('PATCH /api/organizer/settings error', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
