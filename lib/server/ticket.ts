import { getServerSupabase } from '@/lib/supabase/server';
import { generateTicketId, generateRefundCode } from '@/lib/server/ids';
import { sendTicketEmail } from '@/lib/server/email';
import { calculateFees } from '@/lib/server/fees';

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
 */
export async function createTicketFromPayment(p: PaymentData): Promise<string | null> {
  const db = getServerSupabase();

  // Idempotency — if any ticket rows already exist for this reference the webhook
  // has already been processed. Return the first ticket ID without re-inserting.
  const { data: existing } = await db
    .from('tickets')
    .select('id')
    .eq('paystack_reference', p.reference)
    .order('purchased_at', { ascending: true });
  if (existing && existing.length > 0) return existing[0].id;

  // Fetch event and tier in parallel
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

  // Build one row per ticket
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

  // These run once per transaction, not once per individual ticket
  await Promise.all([
    db.rpc('increment_tier_sold', { tier_id: p.tierId, amount: qty }),
    upsertPayout(db, p.eventId, eventRow, subtotal, fee, net),
  ]);

  // Fire-and-forget — email failure must never block the webhook response
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
  const { data: existing } = await db
    .from('payouts')
    .select('id, gross, fee, net')
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    await db.from('payouts').update({
      gross: existing.gross + subtotal,
      fee:   existing.fee   + fee,
      net:   existing.net   + net,
    }).eq('id', existing.id);
  } else {
    const { data: org } = await db
      .from('users')
      .select('name')
      .eq('id', eventRow.organizer_id)
      .maybeSingle();
    await db.from('payouts').insert({
      event_id:       eventId,
      organizer_id:   eventRow.organizer_id,
      organizer_name: org?.name || '',
      event_name:     eventRow.event_name,
      date:           eventRow.date,
      gross:          subtotal,
      fee,
      net,
      status:         'pending',
      reference:      `VTR-PAY-${eventId.slice(0, 8)}-${Date.now()}`,
    });
  }
}
