import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// Manual payout for now, per the brief — the ledger (platform_affiliate_commissions,
// one row per sale with its own status/paid_at/paid_by) is shaped so an
// automated payout run could later just query status='pending' and do this
// same update, instead of admin clicking through one at a time.
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

  const { data: commission } = await db
    .from('platform_affiliate_commissions')
    .select('id, status, event_id, event:events!platform_affiliate_commissions_event_id_fkey(status)')
    .eq('id', id)
    .maybeSingle();

  if (!commission) return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
  if (commission.status === 'paid') {
    return NextResponse.json({ error: 'Already marked paid' }, { status: 400 });
  }
  if (commission.status === 'void') {
    return NextResponse.json({ error: 'This commission was voided — its event was cancelled' }, { status: 400 });
  }
  const eventRaw = commission.event as { status: string }[] | { status: string } | null;
  const eventStatus = (Array.isArray(eventRaw) ? eventRaw[0] : eventRaw)?.status;
  if (eventStatus !== 'completed') {
    return NextResponse.json({ error: 'This event hasn\'t happened yet — commission is only payable once it\'s confirmed complete' }, { status: 400 });
  }

  const { error } = await db
    .from('platform_affiliate_commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: user.email })
    .eq('id', id);

  if (error) {
    console.error('POST /api/admin/affiliates/commissions/[id]/mark-paid error', error);
    return NextResponse.json({ error: 'Failed to mark paid' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
