import type { getServerSupabase } from '@/lib/supabase/server';
import { PLATFORM_FEE_RATE } from '@/lib/fees';

/**
 * The affiliate's cut of Ventry's own platform fee — 30% of it, never of the
 * organiser's gross directly. For the standard 3% platform fee this works
 * out to the brief's "0.9% of gross ticket sales," but it's computed off the
 * organiser's *actual* platform_fee_rate (some accounts are grandfathered at
 * a lower rate) so Ventry never pays out more commission than the fee it
 * actually collected on that sale.
 */
const AFFILIATE_SHARE_OF_PLATFORM_FEE = 0.3;

/**
 * Records a commission ledger row for one sale, if (and only if) the
 * organizer was referred by a platform affiliate and this event is within
 * their first two qualifying events. Called from the same place a sale's
 * gross feeds into calculateFees() for the payout — one row per sale, never
 * a mutated running total, so the ledger stays a straightforward append-only
 * audit trail (mirrors why ticket_change_refunds and event_changes are
 * shaped the way they are in Phase 4).
 *
 * Safe to call for every sale unconditionally — it's a no-op (one cheap
 * lookup) for the overwhelming majority of organisers who were never
 * referred by anyone.
 */
export async function recordAffiliateCommissionIfApplicable(
  db: ReturnType<typeof getServerSupabase>,
  params: { organizerId: string; eventId: string; eventName: string; grossAmount: number },
): Promise<void> {
  if (params.grossAmount <= 0) return;

  const { data: referral } = await db
    .from('platform_affiliate_referrals')
    .select('affiliate_id')
    .eq('organizer_id', params.organizerId)
    .maybeSingle();
  if (!referral) return;

  const { data: existingRows } = await db
    .from('platform_affiliate_commissions')
    .select('event_id, event_sequence_number')
    .eq('organizer_id', params.organizerId);

  const rows = existingRows ?? [];
  const distinctEventIds = new Set(rows.map(r => r.event_id));

  let sequenceNumber: number;
  if (distinctEventIds.has(params.eventId)) {
    sequenceNumber = rows.find(r => r.event_id === params.eventId)!.event_sequence_number;
  } else {
    if (distinctEventIds.size >= 2) return; // cap reached — this is a 3rd+ event, no commission ever
    sequenceNumber = distinctEventIds.size + 1;
  }

  const { data: org } = await db.from('users').select('platform_fee_rate').eq('id', params.organizerId).maybeSingle();
  const platformFeeRate = org?.platform_fee_rate ?? PLATFORM_FEE_RATE;
  const commissionAmount = Math.round(params.grossAmount * platformFeeRate * AFFILIATE_SHARE_OF_PLATFORM_FEE);
  if (commissionAmount <= 0) return;

  const { error } = await db.from('platform_affiliate_commissions').insert({
    affiliate_id: referral.affiliate_id,
    organizer_id: params.organizerId,
    event_id: params.eventId,
    event_name: params.eventName,
    gross_amount: params.grossAmount,
    commission_amount: commissionAmount,
    event_sequence_number: sequenceNumber,
  });
  if (error) console.error('recordAffiliateCommissionIfApplicable: insert error', error);
}
