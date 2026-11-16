import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { DEVICE_COOKIE } from '@/lib/server/trustedDevice';

/** The organiser's trusted devices (057), newest use first; flags this browser. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getServerSupabase()
    .from('organizer_trusted_devices')
    .select('id, token_hash, label, created_at, last_used_at')
    .eq('user_id', user.sub)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('last_used_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Failed to load devices' }, { status: 500 });

  const mine = req.cookies.get(DEVICE_COOKIE)?.value;
  const mineHash = mine ? createHash('sha256').update(mine).digest('hex') : null;
  return NextResponse.json({
    success: true,
    data: (data ?? []).map(d => ({ id: d.id, label: d.label, createdAt: d.created_at, lastUsedAt: d.last_used_at, current: d.token_hash === mineHash })),
  });
}
