import { getServerSupabase } from '@/lib/supabase/server';
import { generateTicketId, generateRefundCode } from '@/lib/server/ids';
import { sendTicketEmail } from '@/lib/server/email';
import { calculateFees, serviceFeePerTicket } from '@/lib/server/fees';
import { notify } from '@/lib/server/notify';

export interface CartItem {
  tierId: string;
  quantity: number;
}

export interface PaymentData {
  reference: string;
  eventId: string;
  items: CartItem[];
  totalPaidKobo: number;
  buyerEmail?: string;
  buyerName?: string;
  customerEmail?: string;
  marketingConsent?: boolean;
  ventryMarketingConsent?: boolean;
  refCode?: string;
}

/**
 * Idempotently creates individual ticket records from a verified Paystack payment.
 * One row is inserted per ticket — an order of 2 Regular + 1 VIP creates three rows
 * with separate IDs, QR codes, and refund codes across their respective tiers.
 * Returns the first ticket ID or null on failure.
 *
 * Idempotency is enforced atomically via the `purchases` table: the first call
 * claims the paystack_reference with a PRIMARY KEY INSERT. Any concurrent or
 * duplicate call receives a unique_violation (23505) and short-circuits.
 * This eliminates the webhook + callback race condition.
 */
export async function createTicketFromPayment(p: PaymentData): Promise<string | null> {
  const db = getServerSupabase();

  // ── Atomic idempotency claim ─────────────────────────────────────
  const { error: claimErr } = await db
    .from('purchases')
    .insert({ paystack_reference: p.reference, created_at: new Date().toISOString() });

  if (claimErr) {
    if (claimErr.code === '23505') {
      const { data: first } = await db
        .from('tickets')
        .select('id')
        .eq('paystack_reference', p.reference)
        .order('purchased_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!first) {
        // Reference was claimed by an earlier call that then failed before
        // inserting a ticket. reconcilePendingOrders() retries these
        // "stuck claim" references directly via createTicketFromClaimedPayment
        // (bypassing this claim step, since it's already taken), so this is
        // surfaced but not permanently stuck.
        console.error('createTicketFromPayment: reference claimed but no ticket exists', p.reference);
        await notifyAdminFailure(p, 'Payment claimed but no ticket was created on a prior attempt (stuck claim). Will be retried automatically.');
      }
      return first?.id ?? null;
    }
    console.error('createTicketFromPayment: purchases insert error', claimErr);
    await notifyAdminFailure(p, `Failed to claim payment reference: ${claimErr.message}`);
    return null;
  }

  return createTicketFromClaimedPayment(p);
}

/**
 * Builds and inserts ticket rows for a payment whose `purchases` idempotency
 * claim already exists — either because createTicketFromPayment just made it,
 * or because reconcilePendingOrders() is retrying a "stuck claim" (a prior
 * attempt claimed the reference then failed before any ticket was inserted).
 * Callers retrying a stuck claim must first confirm no ticket already exists
 * for the reference, since this function performs no idempotency check itself.
 */
export async function createTicketFromClaimedPayment(p: PaymentData): Promise<string | null> {
  const db = getServerSupabase();

  const items = (p.items ?? []).filter(i => i.tierId && i.quantity > 0);
  if (items.length === 0) {
    console.error('createTicketFromPayment: no items in payment', p.reference);
    await notifyAdminFailure(p, 'Payment claimed but carried no ticket line items.');
    return null;
  }

  // ── Fetch event and every requested tier in parallel ────────────
  const [{ data: eventRow, error: eventErr }, { data: tierRows, error: tierErr }] = await Promise.all([
    db.from('events')
      .select('event_name, date, time, event_mode, venue, organizer_id, banner_url')
      .eq('id', p.eventId)
      .maybeSingle(),
    db.from('ticket_tiers')
      .select('id, name, price')
      .in('id', items.map(i => i.tierId)),
  ]);

  if (eventErr || tierErr) {
    console.error('createTicketFromPayment: DB error', { eventErr, tierErr });
    await notifyAdminFailure(p, `Payment claimed but event/tier lookup failed: ${eventErr?.message || tierErr?.message}`);
    return null;
  }
  const tierById = new Map((tierRows ?? []).map(t => [t.id, t]));
  const missingTier = items.find(i => !tierById.has(i.tierId));
  if (!eventRow || missingTier) {
    console.error('createTicketFromPayment: event or tier not found', { eventId: p.eventId, items });
    await notifyAdminFailure(p, `Payment claimed but event/tier no longer exists (eventId: ${p.eventId}).`);
    return null;
  }

  const { data: orgRow } = await db
    .from('users')
    .select('name, platform_fee_rate')
    .eq('id', eventRow.organizer_id)
    .maybeSingle();

  const email        = (p.buyerEmail || p.customerEmail || '').toLowerCase().trim();
  const purchasedAt  = new Date().toISOString();
  const consent      = p.marketingConsent === true;
  const ventryConsent = p.ventryMarketingConsent === true;

  // Flatten items into one row per individual ticket, each carrying its own
  // tier's subtotal/service fee. The processing fee is order-level (Paystack's
  // rate/threshold/cap apply to the single amount actually charged, not per
  // tier), so it's prorated across every ticket by its share of the combined
  // pre-processing amount, with the very last ticket absorbing whatever
  // rounding remainder is left — same pattern the single-tier code used
  // within one tier, just generalized across tiers of differing price.
  type TicketUnit = { tierId: string; tierName: string; subtotal: number; serviceFee: number };
  const units: TicketUnit[] = [];
  for (const item of items) {
    const tier = tierById.get(item.tierId)!;
    const serviceFee = serviceFeePerTicket(tier.price);
    for (let i = 0; i < item.quantity; i++) {
      units.push({ tierId: item.tierId, tierName: tier.name, subtotal: tier.price, serviceFee });
    }
  }

  const subtotal        = units.reduce((s, u) => s + u.subtotal, 0);
  const totalServiceFee = units.reduce((s, u) => s + u.serviceFee, 0);
  const preProcessingTotal = subtotal + totalServiceFee;
  const { fee, net } = calculateFees(subtotal, orgRow?.platform_fee_rate);

  const ticketIds: string[]   = [];
  const refundCodes: string[] = [];
  for (let i = 0; i < units.length; i++) {
    ticketIds.push(generateTicketId());
    refundCodes.push(generateRefundCode());
  }

  let allocatedKobo = 0;
  const rows = units.map((unit, i) => {
    const unitPreProcessing = unit.subtotal + unit.serviceFee;
    const isLast = i === units.length - 1;
    const totalPaidKobo = isLast
      ? p.totalPaidKobo - allocatedKobo
      : Math.floor(p.totalPaidKobo * (preProcessingTotal > 0 ? unitPreProcessing / preProcessingTotal : 1 / units.length));
    if (!isLast) allocatedKobo += totalPaidKobo;
    const totalPaid = totalPaidKobo / 100;

    return {
      id:                  ticketIds[i],
      event_id:            p.eventId,
      tier_id:             unit.tierId,
      organizer_id:        eventRow.organizer_id,
      buyer_name:          p.buyerName || email,
      buyer_email:         email,
      quantity:            1,
      total_paid:          totalPaid,
      // Exact breakdown, persisted so refunds never need to reverse-engineer
      // it from total_paid. processing_fee absorbs the per-ticket proration
      // remainder, so the three columns always sum exactly to total_paid.
      subtotal:            unit.subtotal,
      service_fee:         unit.serviceFee,
      processing_fee:      totalPaid - unit.subtotal - unit.serviceFee,
      status:              'valid',
      purchased_at:        purchasedAt,
      refund_code:         refundCodes[i],
      qr_token:            ticketIds[i],
      paystack_reference:  p.reference,
      marketing_consent:   consent,
      ventry_marketing_consent: ventryConsent,
    };
  });

  const { error: insertErr } = await db.from('tickets').insert(rows);
  if (insertErr) {
    console.error('createTicketFromPayment: tickets insert error', insertErr);
    await notifyAdminFailure(p, `Payment claimed but ticket insert failed: ${insertErr.message}`);
    return null;
  }

  await Promise.all([
    ...items.map(item => db.rpc('increment_tier_sold', { tier_id: item.tierId, amount: item.quantity })),
    upsertPayout(db, p.eventId, eventRow, orgRow?.name ?? '', subtotal, fee, net),
  ]);

  // Box 1 consent (organiser mailing list) — adds/reactivates this buyer in
  // the organiser's Audience. Never touches anything if consent wasn't given.
  if (consent && email) {
    (async () => {
      try {
        const { error } = await db.rpc('upsert_audience_member', {
          p_organizer_id: eventRow.organizer_id,
          p_email:        email,
          p_name:         p.buyerName || null,
          p_phone:        null,
          p_source:       'ticket_consent',
        });
        if (error) console.error('createTicketFromPayment: audience upsert error', error);
      } catch (err) {
        console.error('createTicketFromPayment: audience upsert error', err);
      }
    })();
  }

  if (p.refCode) {
    // One buy per completed order, not per ticket. This only runs on the real
    // creation path above (never on the idempotent-duplicate short-circuit),
    // so a webhook retry can't double-credit the affiliate.
    (async () => {
      try {
        const { error } = await db.rpc('increment_affiliate_buys', { p_code: p.refCode, p_amount: 1 });
        if (error) console.error('createTicketFromPayment: affiliate credit rpc error', error);
      } catch (err) {
        console.error('createTicketFromPayment: affiliate credit error', err);
      }
    })();
  }

  const totalQty = units.length;
  const tierCounts = new Map<string, number>();
  for (const u of units) tierCounts.set(u.tierName, (tierCounts.get(u.tierName) ?? 0) + 1);
  const tierSummary = Array.from(tierCounts.entries()).map(([name, n]) => `${n} × ${name}`).join(', ');

  notify(
    { type: 'organizer', id: eventRow.organizer_id },
    {
      notifType: 'purchase',
      title:     `${totalQty} ticket${totalQty > 1 ? 's' : ''} sold — ${eventRow.event_name}`,
      body:      `${p.buyerName || email} purchased ${tierSummary}`,
      link:      '/organizer/dashboard',
    },
  ).catch(err => console.error('createTicketFromPayment: notify error', err));

  try {
    await sendTicketEmail({
      to:          email,
      buyerName:   p.buyerName || '',
      tickets:     rows.map((r, i) => ({ ticketId: r.id, refundCode: refundCodes[i], tierName: units[i].tierName })),
      paystackRef: p.reference,
      eventName:   eventRow.event_name,
      eventDate:   eventRow.date,
      eventVenue:  eventRow.venue,
      eventMode:   eventRow.event_mode,
      subtotal:      subtotal,
      serviceFee:    totalServiceFee,
      processingFee: (p.totalPaidKobo / 100) - subtotal - totalServiceFee,
      totalPaid:   p.totalPaidKobo / 100,
      bannerUrl:   eventRow.banner_url,
    });
  } catch (err) {
    console.error('createTicketFromPayment: email error (ticket created)', { ticketId: ticketIds[0], email, err });
    notify(
      { type: 'admin' },
      {
        notifType: 'email_failed',
        title:     `Ticket email failed — ${eventRow.event_name}`,
        body:      `${p.buyerName || email} (${email}) bought ${totalQty} ticket(s) but the confirmation email failed to send. Ticket: ${ticketIds[0]}. Resend it from the ticket's admin page.`,
        link:      `/admin/buyers?search=${encodeURIComponent(email)}`,
      },
    ).catch(notifyErr => console.error('createTicketFromPayment: notify-admin error', notifyErr));
  }

  return ticketIds[0];
}

function notifyAdminFailure(p: PaymentData, reason: string): Promise<void> {
  const email = (p.buyerEmail || p.customerEmail || '').toLowerCase().trim();
  return notify(
    { type: 'admin' },
    {
      notifType: 'ticket_creation_failed',
      title:     `Ticket creation failed — ${p.reference}`,
      body:      `${p.buyerName || email} (${email}) paid but no ticket was created. ${reason}`,
      link:      `/admin/buyers?search=${encodeURIComponent(email)}`,
    },
  ).catch(err => console.error('notifyAdminFailure: notify error', err));
}

async function upsertPayout(
  db: ReturnType<typeof getServerSupabase>,
  eventId: string,
  eventRow: { event_name: string; date: string; organizer_id: string },
  organizerName: string,
  subtotal: number,
  fee: number,
  net: number,
) {
  await db.rpc('upsert_payout', {
    p_event_id:       eventId,
    p_organizer_id:   eventRow.organizer_id,
    p_organizer_name: organizerName,
    p_event_name:     eventRow.event_name,
    p_date:           eventRow.date,
    p_gross:          subtotal,
    p_fee:            fee,
    p_net:            net,
  });
}
