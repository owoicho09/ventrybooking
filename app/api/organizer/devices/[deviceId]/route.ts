import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireChangeGrant } from '@/lib/server/settingsChange';

/**
 * Remove a trusted device (057): signing in on it will need an emailed code
 * again. Like every settings change it needs the emailed-code grant (055).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServerSupabase();
  const denied = await requireChangeGrant(db, user.sub, req);
  if (denied) return denied;

  const { deviceId } = await params;
  const { data, error } = await db
    .from('organizer_trusted_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', deviceId).eq('user_id', user.sub).is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Failed to remove device' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
