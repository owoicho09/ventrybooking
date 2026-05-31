import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServerSupabase();
  const { data } = await db.from('platform_config').select('value').eq('key', 'payout_percentage').single();
  return NextResponse.json({ success: true, data: { percentage: Number(data?.value ?? 100) } });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { percentage } = await req.json();
    const pct = Math.min(100, Math.max(0, Number(percentage)));

    const db = getServerSupabase();
    await db.from('platform_config').upsert({ key: 'payout_percentage', value: String(pct) });

    return NextResponse.json({ success: true, data: { percentage: pct } });
  } catch (err) {
    console.error('payout-settings error', err);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
