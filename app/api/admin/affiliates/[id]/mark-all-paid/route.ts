import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// Bulk convenience over the per-commission mark-paid route — same
// escrow-safe update, just applied to every still-pending row for one
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

  const { data, error } = await db
    .from('platform_affiliate_commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: user.email })
    .eq('affiliate_id', id)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('POST /api/admin/affiliates/[id]/mark-all-paid error', error);
    return NextResponse.json({ error: 'Failed to mark commissions paid' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { marked: data?.length ?? 0 } });
}
