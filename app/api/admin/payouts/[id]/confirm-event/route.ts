import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    await db.from('payouts').update({ status: 'processing' }).eq('id', id).eq('status', 'pending');
    await db.from('events')
      .update({ status: 'completed' })
      .eq('id', (await db.from('payouts').select('event_id').eq('id', id).single()).data?.event_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('confirm-event error', err);
    return NextResponse.json({ error: 'Failed to confirm event' }, { status: 500 });
  }
}
