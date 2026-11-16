import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyChangeCode } from '@/lib/server/settingsChange';

/** Step 2: the typed code becomes a 10-minute grant for settings changes. */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await req.json().catch(() => ({})) as { code?: unknown };
  const res = await verifyChangeCode(getServerSupabase(), user.sub, 'settings', code);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ success: true, data: { token: res.grant, expiresAt: res.grantExpiresAt } });
}
