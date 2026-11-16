import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { accessCodeProblem, normalizeAccessCode } from '@/lib/server/tierAccess';
import { MAX_CODES_PER_TIER, ownedTier } from '@/lib/server/tierGatesInput';

type Params = { params: Promise<{ id: string; tierId: string }> };

/** A tier's promo codes, with how many tickets each one has sold. */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, tierId } = await params;
  const db = getServerSupabase();
  if (!(await ownedTier(db, user.sub, id, tierId))) return NextResponse.json({ error: 'Tier not found' }, { status: 404 });

  const { data: codes, error } = await db
    .from('tier_access_codes')
    .select('id, code, active, created_at')
    .eq('tier_id', tierId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'Failed to load codes' }, { status: 500 });

  const uses: Record<string, number> = {};
  if (codes?.length) {
    const { data: sold } = await db
      .from('tickets')
      .select('access_code_id')
      .in('access_code_id', codes.map(c => c.id))
      .in('status', ['valid', 'used']);
    for (const t of sold ?? []) uses[t.access_code_id as string] = (uses[t.access_code_id as string] ?? 0) + 1;
  }

  return NextResponse.json({
    success: true,
    data: (codes ?? []).map(c => ({ id: c.id, code: c.code, active: c.active, createdAt: c.created_at, ticketsSold: uses[c.id] ?? 0 })),
  });
}

/** Add a code to a tier: { code }. */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, tierId } = await params;
  const db = getServerSupabase();
  if (!(await ownedTier(db, user.sub, id, tierId))) return NextResponse.json({ error: 'Tier not found' }, { status: 404 });

  const { code: raw } = await req.json().catch(() => ({})) as { code?: unknown };
  const code = normalizeAccessCode(raw);
  const problem = accessCodeProblem(code);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const { count } = await db.from('tier_access_codes').select('id', { count: 'exact', head: true }).eq('tier_id', tierId);
  if ((count ?? 0) >= MAX_CODES_PER_TIER) {
    return NextResponse.json({ error: `Up to ${MAX_CODES_PER_TIER} codes per tier. Switch an old one off and reuse it instead.` }, { status: 400 });
  }

  const { data, error } = await db
    .from('tier_access_codes')
    .insert({ event_id: id, tier_id: tierId, code })
    .select('id, code, active, created_at')
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `${code} is already a code on this event` }, { status: 409 });
    console.error('POST tier code error', error);
    return NextResponse.json({ error: 'Failed to add code' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { id: data.id, code: data.code, active: data.active, createdAt: data.created_at, ticketsSold: 0 } }, { status: 201 });
}
