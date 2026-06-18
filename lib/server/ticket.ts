import { getServerSupabase } from '@/lib/supabase/server';
import { generateTicketId, generateRefundCode } from '@/lib/server/ids';
import { sendTicketEmail } from '@/lib/server/email';
import { calculateFees } from '@/lib/server/fees';
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
  // INSERT into purchases is atomic. Only one concurrent caller can succeed;
  // the other receives error code 23505 (unique_violation) and bails out.
  const { error: claimErr } = await db
    .from('purchases')
    .insert({ paystack_reference: p.reference, created_at: new Date().toISOString() });

  if (claimErr) {
    if (claimErr.code === '23505') {
      // Another request already processed this payment — return the first ticket
      const { data: first } = await db
        .from('tickets')
        .select('id')
        .eq('paystack_reference', p.reference)
        .order('purchased_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      return first?.id ?? null;
    }
    console.error('createTicketFromPayment: purchases insert error', claimErr);
    return null;
  }

  // ── Fetch event and tier in parallel ────────────────────────────
  const [{ data: eventRow, error: eventErr }, { data: tierRow, error: tierErr }] = await Promise.all([
    db.from('events')
      .select('event_name, date, time, venue, organizer_id')
      .eq('id', p.eventId)
      .maybeSingle(),
    db.from('ticket_tiers')
      .select('name, price')
      .eq('id', p.tierId)
      .maybeSingle(),
  ]);

  if (eventErr || tierErr) {
    console.error('createTicketFromPayment: DB error', { eventErr, tierErr });
    return null;
  }
  if (!eventRow || !tierRow) {
    console.error('createTicketFromPayment: event or tier not found', { eventId: p.eventId, tierId: p.tierId });
    return null;
  }

  const qty = Math.max(1, p.quantity);

  // Split total_paid evenly across tickets using integer kobo arithmetic so the
  // sum of all per-ticket total_paid equals the original transaction amount exactly.
  const baseKobo    = Math.floor(p.totalPaidKobo / qty);
  const lastKobo    = p.totalPaidKobo - baseKobo * (qty - 1);

  const subtotal    = tierRow.price * qty;
  const { fee, net } = calculateFees(subtotal);
  const email       = (p.buyerEmail || p.customerEmail || '').toLowerCase().trim();
  const purchasedAt = new Date().toISOString();

  const ticketIds: string[]   = [];
  const refundCodes: string[] = [];
  for (let i = 0; i < qty; i++) {
    ticketIds.push(generateTicketId());
    refundCodes.push(generateRefundCode());
  }

  const rows = ticketIds.map((id, i) => ({
    id,
    event_id:           p.eventId,
    tier_id:            p.tierId,
    organizer_id:       eventRow.organizer_id,
    buyer_name:         p.buyerName || email,
    buyer_email:        email,
    quantity:           1,
    total_paid:         (i < qty - 1 ? baseKobo : lastKobo) / 100,
    status:             'valid',
    purchased_at:       purchasedAt,
    refund_code:        refundCodes[i],
    qr_token:           id,
    paystack_reference: p.reference,
  }));

  await db.from('tickets').insert(rows);

  await Promise.all([
    db.rpc('increment_tier_sold', { tier_id: p.tierId, amount: qty }),
    upsertPayout(db, p.eventId, eventRow, subtotal, fee, net),
  ]);

  // Notify the organizer of the new purchase (fire-and-forget — non-blocking)
  notify(
    { type: 'organizer', id: eventRow.organizer_id },
    {
      notifType: 'purchase',
      title:     `${qty} ticket${qty > 1 ? 's' : ''} sold — ${eventRow.event_name}`,
      body:      `${p.buyerName || email} purchased ${qty} × ${tierRow.name}`,
      link:      '/organizer/dashboard',
    },
  ).catch(err => console.error('createTicketFromPayment: notify error', err));

  // Fire-and-forget — email failure must never block the webhook response.
  // The ticket page at /ticket/{id} always shows the QR so buyers can recover.
  sendTicketEmail({
    to:          email,
    buyerName:   p.buyerName || '',
    tickets:     ticketIds.map((id, i) => ({ ticketId: id, refundCode: refundCodes[i] })),
    paystackRef: p.reference,
    eventName:   eventRow.event_name,
    eventDate:   eventRow.date,
    eventVenue:  eventRow.venue,
    tierName:    tierRow.name,
    totalPaid:   p.totalPaidKobo / 100,
  }).catch(err => console.error('createTicketFromPayment: email error (ticket created)', err));

  return ticketIds[0];
}

async function upsertPayout(
  db: ReturnType<typeof getServerSupabase>,
  eventId: string,
  eventRow: { event_name: string; date: string; organizer_id: string },
  subtotal: number,
  fee: number,
  net: number,
) {
  // Fetch organiser name for the initial INSERT (the ON CONFLICT path doesn't need it).
  const { data: org } = await db
    .from('users')
    .select('name')
    .eq('id', eventRow.organizer_id)
    .maybeSingle();

  // upsert_payout is an atomic Postgres function (migration section 7).
  // It does INSERT ... ON CONFLICT (event_id) DO UPDATE gross += ..., eliminating
  // the read-then-write TOCTOU race present in the old JS SELECT + INSERT/UPDATE pattern.
  // `reference` is intentionally omitted — the release route sets it as a distributed
  // lock (IS NULL guard) before calling Paystack, preventing concurrent double-transfers.
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
