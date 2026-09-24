import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkSettlementStatus } from '@/lib/server/settlements';

/** "Check status" — asks Paystack what happened to an in-flight settlement. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const result = await checkSettlementStatus(getServerSupabase(), id);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 502 });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('settlement verify error', id, err);
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 });
  }
}
