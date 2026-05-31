import { getServerSupabase } from '@/lib/supabase/server';
import { generateTicketId, generateRefundCode } from '@/lib/server/ids';
import { signQrToken } from '@/lib/server/jwt';
import { generateQRDataUrl } from '@/lib/server/qr';
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
 * Idempotently creates a ticket from a verified Paystack payment.
 * Returns the ticket ID (existing or newly created).
 * Returns null when the event/tier cannot be found.
 */
export async function createTicketFromPayment(p: PaymentData): Promise<string | null> {
  const db = getServerSupabase();

  // Idempotency — return existing ticket ID if already processed
  const { data: existing } = await db
    .from('tickets')
    .select('id')
    .eq('paystack_reference', p.reference)
    .maybeSingle();
  if (existing) return existing.id;

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

  const ticketId   = generateTicketId();
  const refundCode = generateRefundCode();
  const qrToken    = signQrToken({ ticketId, eventId: p.eventId });
  const qrDataUrl  = await generateQRDataUrl(qrToken);
  const totalPaid  = p.totalPaidKobo / 100;
  const subtotal   = tierRow.price * p.quantity;
  const { fee, net } = calculateFees(subtotal);
  const email = (p.buyerEmail || p.customerEmail || '').toLowerCase().trim();

  await db.from('tickets').insert({
    id:                 ticketId,
    event_id:           p.eventId,
    tier_id:            p.tierId,
    organizer_id:       eventRow.organizer_id,
    buyer_name:         p.buyerName || email,
    buyer_email:        email,
    quantity:           p.quantity,
    total_paid:         totalPaid,
    status:             'valid',
    purchased_at:       new Date().toISOString(),
    refund_code:        refundCode,
    qr_token:           qrToken,
    paystack_reference: p.reference,
  });

  // These three can run in parallel
  await Promise.all([
    db.rpc('increment_tier_sold', { tier_id: p.tierId, amount: p.quantity }),
    upsertPayout(db, p.eventId, eventRow, subtotal, fee, net),
  ]);

  // Fire-and-forget email — a Resend failure must never block the redirect
  sendTicketEmail({
    to:         email,
    buyerName:  p.buyerName || '',
    ticketId,
    eventName:  eventRow.event_name,
    eventDate:  eventRow.date,
    eventVenue: eventRow.venue,
    tierName:   tierRow.name,
    quantity:   p.quantity,
    totalPaid,
    refundCode,
    qrDataUrl,
  }).catch(err => console.error('createTicketFromPayment: email error (ticket created)', err));

  return ticketId;
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
