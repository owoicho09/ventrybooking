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
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (!commission) return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
  if (commission.status === 'paid') {
    return NextResponse.json({ error: 'Already marked paid' }, { status: 400 });
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
