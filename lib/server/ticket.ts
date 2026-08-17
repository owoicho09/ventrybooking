import { getServerSupabase } from '@/lib/supabase/server';
import { generateTicketId, generateRefundCode } from '@/lib/server/ids';
import { sendTicketEmail } from '@/lib/server/email';
import { calculateFees, serviceFeePerTicket } from '@/lib/server/fees';
import { notify } from '@/lib/server/notify';

export interface PaymentData {
  reference: string;
  eventId: string;
  tierId: string;
  quantity: number;
  totalPaidKobo: number;
  buyerEmail?: string;
  buyerName?: string;
  customerEmail?: string;
  marketingConsent?: boolean;
  refCode?: string;
}

/**
 * Idempotently creates individual ticket records from a verified Paystack payment.
 * One row is inserted per ticket — quantity=2 creates two rows with separate IDs,
 * QR codes, and refund codes. Returns the first ticket ID or null on failure.
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
        // inserting a ticket — that attempt is permanently stuck (retries
        // will hit this same branch forever). Surface it instead of
        // returning silently.
        console.error('createTicketFromPayment: reference claimed but no ticket exists', p.reference);
        await notifyAdminFailure(p, 'Payment claimed but no ticket was created on a prior attempt (stuck claim).');
      }
      return first?.id ?? null;
    }
    console.error('createTicketFromPayment: purchases insert error', claimErr);
    await notifyAdminFailure(p, `Failed to claim payment reference: ${claimErr.message}`);
    return null;
  }

  // ── Fetch event and tier in parallel ────────────────────────────
  const [{ data: eventRow, error: eventErr }, { data: tierRow, error: tierErr }] = await Promise.all([
    db.from('events')
      .select('event_name, date, time, event_mode, venue, organizer_id, banner_url')
      .eq('id', p.eventId)
      .maybeSingle(),
    db.from('ticket_tiers')
      .select('name, price')
      .eq('id', p.tierId)
      .maybeSingle(),
  ]);

  if (eventErr || tierErr) {
    console.error('createTicketFromPayment: DB error', { eventErr, tierErr });
    await notifyAdminFailure(p, `Payment claimed but event/tier lookup failed: ${eventErr?.message || tierErr?.message}`);
    return null;
  }
  if (!eventRow || !tierRow) {
    console.error('createTicketFromPayment: event or tier not found', { eventId: p.eventId, tierId: p.tierId });
    await notifyAdminFailure(p, `Payment claimed but event/tier no longer exists (eventId: ${p.eventId}, tierId: ${p.tierId}).`);
    return null;
  }

  const qty = Math.max(1, p.quantity);

  const baseKobo = Math.floor(p.totalPaidKobo / qty);
  const lastKobo = p.totalPaidKobo - baseKobo * (qty - 1);

  const subtotal    = tierRow.price * qty;
  const { fee, net } = calculateFees(subtotal);
  const email       = (p.buyerEmail || p.customerEmail || '').toLowerCase().trim();
  const purchasedAt = new Date().toISOString();
  const consent     = p.marketingConsent === true;

  const ticketIds: string[]   = [];
  const refundCodes: string[] = [];
  for (let i = 0; i < qty; i++) {
    ticketIds.push(generateTicketId());
    refundCodes.push(generateRefundCode());
  }

  const perTicketSubtotal   = tierRow.price;
  const perTicketServiceFee = serviceFeePerTicket(tierRow.price);

  const rows = ticketIds.map((id, i) => {
    const totalPaid = (i < qty - 1 ? baseKobo : lastKobo) / 100;
    return {
      id,
      event_id:           p.eventId,
      tier_id:            p.tierId,
      organizer_id:       eventRow.organizer_id,
      buyer_name:         p.buyerName || email,
      buyer_email:        email,
      quantity:           1,
      total_paid:         totalPaid,
      // Exact breakdown, persisted so refunds never need to reverse-engineer
      // it from total_paid. processing_fee absorbs the per-ticket proration
      // remainder, so the three columns always sum exactly to total_paid.
      subtotal:           perTicketSubtotal,
      service_fee:        perTicketServiceFee,
      processing_fee:     totalPaid - perTicketSubtotal - perTicketServiceFee,
      status:             'valid',
      purchased_at:       purchasedAt,
      refund_code:        refundCodes[i],
      qr_token:           id,
      paystack_reference: p.reference,
      marketing_consent:  consent,
    };
  });

  const { error: insertErr } = await db.from('tickets').insert(rows);
  if (insertErr) {
    console.error('createTicketFromPayment: tickets insert error', insertErr);
    await notifyAdminFailure(p, `Payment claimed but ticket insert failed: ${insertErr.message}`);
    return null;
  }

  await Promise.all([
    db.rpc('increment_tier_sold', { tier_id: p.tierId, amount: qty }),
    upsertPayout(db, p.eventId, eventRow, subtotal, fee, net),
  ]);

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

  notify(
    { type: 'organizer', id: eventRow.organizer_id },
    {
      notifType: 'purchase',
      title:     `${qty} ticket${qty > 1 ? 's' : ''} sold — ${eventRow.event_name}`,
      body:      `${p.buyerName || email} purchased ${qty} × ${tierRow.name}`,
      link:      '/organizer/dashboard',
    },
  ).catch(err => console.error('createTicketFromPayment: notify error', err));

  try {
    await sendTicketEmail({
      to:          email,
      buyerName:   p.buyerName || '',
      tickets:     ticketIds.map((id, i) => ({ ticketId: id, refundCode: refundCodes[i] })),
      paystackRef: p.reference,
      eventName:   eventRow.event_name,
      eventDate:   eventRow.date,
      eventVenue:  eventRow.venue,
      eventMode:   eventRow.event_mode,
      tierName:    tierRow.name,
      subtotal:      subtotal,
      serviceFee:    perTicketServiceFee * qty,
      processingFee: (p.totalPaidKobo / 100) - subtotal - perTicketServiceFee * qty,
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
        body:      `${p.buyerName || email} (${email}) bought ${qty} ticket(s) but the confirmation email failed to send. Ticket: ${ticketIds[0]}. Resend it from the ticket's admin page.`,
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
  subtotal: number,
  fee: number,
  net: number,
) {
  const { data: org } = await db
    .from('users')
    .select('name')
    .eq('id', eventRow.organizer_id)
    .maybeSingle();

  await db.rpc('upsert_payout', {
    p_event_id:       eventId,
    p_organizer_id:   eventRow.organizer_id,
    p_organizer_name: org?.name ?? '',
    p_event_name:     eventRow.event_name,
    p_date:           eventRow.date,
    p_gross:          subtotal,
    p_fee:            fee,
    p_net:            net,
  });
}
