import { getServerSupabase } from '@/lib/supabase/server';
import { verifyTransaction } from '@/lib/server/paystack';
import { createTicketFromPayment, createTicketFromClaimedPayment, type PaymentData } from '@/lib/server/ticket';
import { notify } from '@/lib/server/notify';

const STALE_MINUTES = 10;

interface PendingOrderRow {
  reference: string;
  event_id: string;
  tier_id: string;
  quantity: number;
  items: { tier_id: string; quantity: number }[] | null;
  buyer_email: string;
  buyer_name: string;
  total: number;
  marketing_consent: boolean;
  ventry_marketing_consent: boolean;
}

// Re-verifies one stale checkout against Paystack and, if it actually
// succeeded, creates the ticket. `alreadyClaimed` picks the entry point:
// a reference with no `purchases` row goes through the normal claim-then-create
// path, while a "stuck claim" (claimed by a prior attempt that then failed
// before inserting a ticket) skips straight to ticket creation, since
// re-claiming would just find its own earlier row and bail out again.
async function recoverOrder(order: PendingOrderRow, alreadyClaimed: boolean): Promise<string | null> {
  const result = await verifyTransaction(order.reference);
  if (result?.status !== 'success') return null;

  const declaredTotal = Number(result.metadata?.total ?? order.total);
  const totalPaidKobo = Number.isFinite(declaredTotal) && declaredTotal > 0
    ? Math.round(declaredTotal * 100)
    : result.amount;

  // `items` covers multi-tier orders; older rows written before that
  // column existed fall back to their single tier_id/quantity pair.
  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map(i => ({ tierId: i.tier_id, quantity: i.quantity }))
    : [{ tierId: order.tier_id, quantity: order.quantity }];

  const paymentData: PaymentData = {
    reference:         order.reference,
    eventId:           order.event_id,
    items,
    totalPaidKobo,
    buyerEmail:        order.buyer_email,
    buyerName:         order.buyer_name,
    customerEmail:     result.customer?.email,
    marketingConsent:  order.marketing_consent,
    ventryMarketingConsent: order.ventry_marketing_consent,
  };

  return alreadyClaimed
    ? createTicketFromClaimedPayment(paymentData)
    : createTicketFromPayment(paymentData);
}

/**
 * Safety net for the webhook/callback race: a checkout can leave a
 * `pending_orders` row with no ticket if Paystack's webhook never arrives
 * (delivery failure, signature mismatch), the buyer never lands back on the
 * callback URL (closed tab, in-app browser), or an earlier attempt claimed
 * the reference and then failed partway through (a "stuck claim"). This
 * re-verifies every stale, ticket-less checkout directly against Paystack
 * and creates the ticket if the charge actually succeeded.
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
  const [{ data: claimed }, { data: ticketed }] = await Promise.all([
    db.from('purchases').select('paystack_reference').in('paystack_reference', references),
    db.from('tickets').select('paystack_reference').in('paystack_reference', references),
  ]);
  const claimedSet  = new Set((claimed  ?? []).map(c => c.paystack_reference));
  const ticketedSet = new Set((ticketed ?? []).map(t => t.paystack_reference));

  const needsRecovery = pending.filter(p => !ticketedSet.has(p.reference));
  const recovered: string[] = [];

  for (const order of needsRecovery) {
    try {
      const ticketId = await recoverOrder(order, claimedSet.has(order.reference));
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
        body:      `Paystack confirmed payment for ${recovered.length} checkout(s) that never turned into a ticket. References: ${recovered.join(', ')}`,
        link:      '/admin/buyers',
      },
    ).catch(err => console.error('reconcilePendingOrders: notify error', err));
  }

  return { checked: needsRecovery.length, recovered };
}

/**
 * Admin-triggered recovery for one reference — e.g. from a "ticket creation
 * failed" notification that the bulk sweep hasn't reached yet, or a
 * permanently-failed case (event/tier deleted, etc.) after it's been fixed.
 */
export async function regenerateTicketForReference(
  reference: string,
): Promise<{ ok: true; ticketId: string } | { ok: false; reason: string }> {
  const db = getServerSupabase();

  const { data: order } = await db
    .from('pending_orders')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!order) {
    return { ok: false, reason: 'No checkout record found for this reference — cannot recover automatically.' };
  }

  const { data: existingTicket } = await db
    .from('tickets')
    .select('id')
    .eq('paystack_reference', reference)
    .limit(1)
    .maybeSingle();
  if (existingTicket) {
    return { ok: true, ticketId: existingTicket.id };
  }

  const { data: claim } = await db
    .from('purchases')
    .select('paystack_reference')
    .eq('paystack_reference', reference)
    .maybeSingle();

  const ticketId = await recoverOrder(order as PendingOrderRow, !!claim);
  if (!ticketId) {
    return { ok: false, reason: 'Paystack did not confirm a successful payment for this reference, or ticket creation failed again — check server logs.' };
  }
  return { ok: true, ticketId };
}
