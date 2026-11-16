import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { ownedTier } from '@/lib/server/tierGatesInput';

/**
 * Switch a promo code on or off: { active: boolean }. Codes are never
 * deleted, because tickets already sold keep a link to the code they used.
 * Switching one off stops new purchases with it straight away; anyone
 * already in the middle of paying still gets their ticket.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string; codeId: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, tierId, codeId } = await params;
  const db = getServerSupabase();
  if (!(await ownedTier(db, user.sub, id, tierId))) return NextResponse.json({ error: 'Tier not found' }, { status: 404 });

  const { active } = await req.json().catch(() => ({})) as { active?: unknown };
  if (typeof active !== 'boolean') return NextResponse.json({ error: 'active must be true or false' }, { status: 400 });

  const { data, error } = await db
    .from('tier_access_codes')
    .update({ active, deactivated_at: active ? null : new Date().toISOString() })
    .eq('id', codeId)
    .eq('tier_id', tierId)
    .select('id, active')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Failed to update code' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Code not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}
