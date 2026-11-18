import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Per-event price display (060). On: the event page, cards and listings show
 * the exact tier prices with "+ fees", and checkout itemises the service fee.
 * Off (default): advertised prices include the service fee. What the buyer
 * is charged is identical either way.
 * Body: { priceBeforeFees: boolean }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { priceBeforeFees?: unknown };
  if (typeof body.priceBeforeFees !== 'boolean') {
    return NextResponse.json({ error: 'priceBeforeFees must be true or false' }, { status: 400 });
  }

  const { data, error } = await getServerSupabase()
    .from('events')
    .update({ price_before_fees: body.priceBeforeFees })
    .eq('id', id)
    .select('id, price_before_fees')
    .maybeSingle();
  if (error) {
    console.error('POST /api/admin/events/[id]/price-display error', error);
    return NextResponse.json({ error: 'Could not update price display' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}
