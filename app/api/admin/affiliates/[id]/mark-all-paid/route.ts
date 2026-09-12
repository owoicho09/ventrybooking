import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// Bulk convenience over the per-commission mark-paid route — same
// race-condition-safe update, just applied to every still-pending row for one
// affiliate in one action, for when a payout run covers all of it at once.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServerSupabase();

  const { data: pending, error: fetchErr } = await db
    .from('platform_affiliate_commissions')
    .select('id, event:events!platform_affiliate_commissions_event_id_fkey(status)')
    .eq('affiliate_id', id)
    .eq('status', 'pending');

  if (fetchErr) {
    console.error('POST /api/admin/affiliates/[id]/mark-all-paid fetch error', fetchErr);
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
  }

  const payableIds = (pending ?? [])
    .filter(c => {
      const eventRaw = c.event as { status: string }[] | { status: string } | null;
      return (Array.isArray(eventRaw) ? eventRaw[0] : eventRaw)?.status === 'completed';
    })
    .map(c => c.id);
  const skipped = (pending?.length ?? 0) - payableIds.length;

  if (payableIds.length === 0) {
    return NextResponse.json({ success: true, data: { marked: 0, skippedNotConfirmed: skipped } });
  }

  const { data, error } = await db
    .from('platform_affiliate_commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: user.email })
    .in('id', payableIds)
    .select('id');

  if (error) {
    console.error('POST /api/admin/affiliates/[id]/mark-all-paid error', error);
    return NextResponse.json({ error: 'Failed to mark commissions paid' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { marked: data?.length ?? 0, skippedNotConfirmed: skipped } });
}
