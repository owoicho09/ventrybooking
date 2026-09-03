import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// Shows each referred organiser's sales performance only as it relates to
// this affiliate's own commission — never the organiser's full financials
// (no total revenue, no payout status, no bank details).
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'affiliate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();

  const { data: referrals, error } = await db
    .from('platform_affiliate_referrals')
    .select('organizer_id, referred_at, organizer:users!platform_affiliate_referrals_organizer_id_fkey(name, handle)')
    .eq('affiliate_id', user.sub)
    .order('referred_at', { ascending: false });

  if (error) {
    console.error('GET /api/affiliate/referrals error', error);
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
  }

  const organizerIds = (referrals ?? []).map(r => r.organizer_id);
  const { data: commissions } = organizerIds.length > 0
    ? await db
        .from('platform_affiliate_commissions')
        .select('organizer_id, event_name, gross_amount, commission_amount, event_sequence_number, status, created_at')
        .eq('affiliate_id', user.sub)
        .in('organizer_id', organizerIds)
        .order('created_at', { ascending: false })
    : { data: [] as never[] };

  const rows = (referrals ?? []).map(r => {
    const orgRaw = r.organizer as { name: string; handle: string | null }[] | { name: string; handle: string | null } | null;
    const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
    const mine = (commissions ?? []).filter(c => c.organizer_id === r.organizer_id);
    const qualifyingEvents = new Set(mine.map(c => c.event_sequence_number)).size;

    return {
      organizerName: org?.name ?? 'Organiser',
      organizerHandle: org?.handle ?? null,
      referredAt: r.referred_at,
      qualifyingEventsSoFar: qualifyingEvents,
      capReached: qualifyingEvents >= 2,
      totalCommission: mine.reduce((s, c) => s + c.commission_amount, 0),
      pendingCommission: mine.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0),
      sales: mine.map(c => ({
        eventName: c.event_name,
        grossAmount: c.gross_amount,
        commissionAmount: c.commission_amount,
        eventSequenceNumber: c.event_sequence_number,
        status: c.status,
        createdAt: c.created_at,
      })),
    };
  });

  return NextResponse.json({ success: true, data: rows });
}
