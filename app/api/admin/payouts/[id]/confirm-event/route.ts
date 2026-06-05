import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { notify } from '@/lib/server/notify';

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

    // Fetch payout once to get event_id and organizer_id before updating
    const { data: payout } = await db
      .from('payouts')
      .select('id, event_id, organizer_id, event_name, status')
      .eq('id', id)
      .maybeSingle();

    if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    if (payout.status !== 'pending') {
      return NextResponse.json({ error: 'Payout is not in pending state' }, { status: 400 });
    }

    // Update both tables in parallel using the already-fetched event_id
    await Promise.all([
      db.from('payouts').update({ status: 'processing' }).eq('id', id).eq('status', 'pending'),
      db.from('events').update({ status: 'completed' }).eq('id', payout.event_id),
    ]);

    notify(
      { type: 'organizer', id: payout.organizer_id },
      {
        notifType: 'payout',
        title:     `Event confirmed — payout processing`,
        body:      `"${payout.event_name}" has been confirmed. Your payout will be released shortly.`,
        link:      '/organizer/payouts',
      },
    ).catch(err => console.error('confirm-event: notify error', err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('confirm-event error', err);
    return NextResponse.json({ error: 'Failed to confirm event' }, { status: 500 });
  }
}
