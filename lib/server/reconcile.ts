import { getServerSupabase } from '@/lib/supabase/server';
import { verifyTransaction } from '@/lib/server/paystack';
import { createTicketFromPayment } from '@/lib/server/ticket';
import { notify } from '@/lib/server/notify';

const STALE_MINUTES = 10;

/**
 * Safety net for the webhook/callback race: a checkout can leave a
 * `pending_orders` row with no matching `purchases` claim if Paystack's
 * webhook never arrives (delivery failure, signature mismatch) and the
 * buyer never lands back on the callback URL (closed tab, in-app browser).
 * When that happens, ticket creation never runs and nothing else notices.
 *
 * This re-verifies stale, unclaimed checkouts directly against Paystack and
 * creates the ticket if the charge actually succeeded.
 */
export async function reconcilePendingOrders() {
  const db = getServerSupabase();
  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  const { data: pending } = await db
    .from('pending_orders')
    .select('*')
    .lt('created_at', staleBefore)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!pending || pending.length === 0) {
    return { checked: 0, recovered: [] as string[] };
  }

  const references = pending.map(p => p.reference);
  const { data: claimed } = await db
    .from('purchases')
    .select('paystack_reference')
    .in('paystack_reference', references);
  const claimedSet = new Set((claimed ?? []).map(c => c.paystack_reference));

  const unclaimed = pending.filter(p => !claimedSet.has(p.reference));
  const recovered: string[] = [];

  for (const order of unclaimed) {
    try {
      const result = await verifyTransaction(order.reference);
      if (result?.status !== 'success') continue;

      const declaredTotal = Number(result.metadata?.total ?? order.total);
      const totalPaidKobo = Number.isFinite(declaredTotal) && declaredTotal > 0
        ? Math.round(declaredTotal * 100)
        : result.amount;

      const ticketId = await createTicketFromPayment({
        reference:         order.reference,
        eventId:           order.event_id,
        tierId:            order.tier_id,
        quantity:          order.quantity,
        totalPaidKobo,
        buyerEmail:        order.buyer_email,
        buyerName:         order.buyer_name,
        customerEmail:     result.customer?.email,
        marketingConsent:  order.marketing_consent,
      });

      if (ticketId) recovered.push(order.reference);
    } catch (err) {
      console.error('reconcilePendingOrders: failed for', order.reference, err);
    }
  }

  if (recovered.length > 0) {
    await notify(
      { type: 'admin' },
      {
        notifType: 'reconciled',
        title:     `Recovered ${recovered.length} missed ticket${recovered.length > 1 ? 's' : ''}`,
        body:      `Paystack confirmed payment for ${recovered.length} checkout(s) that never triggered ticket creation. References: ${recovered.join(', ')}`,
        link:      '/admin/buyers',
      },
    ).catch(err => console.error('reconcilePendingOrders: notify error', err));
  }

  return { checked: unclaimed.length, recovered };
}
