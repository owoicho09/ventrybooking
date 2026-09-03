import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServerSupabase();

  const { data: affiliate, error } = await db
    .from('platform_affiliates')
    .select('id, name, email, referral_code, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Failed to fetch affiliate' }, { status: 500 });
  if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

  const { data: referrals } = await db
    .from('platform_affiliate_referrals')
    .select('organizer_id, referred_at, organizer:users!platform_affiliate_referrals_organizer_id_fkey(name, email)')
    .eq('affiliate_id', id);

  const organizerNames = new Map<string, string>();
  for (const r of referrals ?? []) {
    const orgRaw = r.organizer as { name: string; email: string }[] | { name: string; email: string } | null;
    const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
    organizerNames.set(r.organizer_id, org?.name ?? 'Organiser');
  }

  const { data: commissions } = await db
    .from('platform_affiliate_commissions')
    .select('id, organizer_id, event_name, gross_amount, commission_amount, event_sequence_number, status, created_at, paid_at, paid_by')
    .eq('affiliate_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    success: true,
    data: {
      affiliate,
      referralCount: referrals?.length ?? 0,
      commissions: (commissions ?? []).map(c => ({
        id: c.id,
        organizerName: organizerNames.get(c.organizer_id) ?? 'Organiser',
        eventName: c.event_name,
        grossAmount: c.gross_amount,
        commissionAmount: c.commission_amount,
        eventSequenceNumber: c.event_sequence_number,
        status: c.status,
        createdAt: c.created_at,
        paidAt: c.paid_at,
        paidBy: c.paid_by,
      })),
    },
  });
}
