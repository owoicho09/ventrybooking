import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { generateTicketId, generateRefundCode } from '@/lib/server/ids';
import { sendTicketEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { eventId, tierId, quantity, buyerEmail, buyerName, marketingConsent } = await req.json();

    if (!eventId || !tierId || !quantity || !buyerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (quantity < 1 || quantity > 10) {
      return NextResponse.json({ error: 'Quantity must be between 1 and 10' }, { status: 400 });
    }

    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('id, event_name, date, time, venue, status, organizer_id')
      .eq('id', eventId)
      .maybeSingle();

    if (!event || event.status !== 'approved') {
      return NextResponse.json({ error: 'Event is not available' }, { status: 400 });
    }

    const { data: tier } = await db
      .from('ticket_tiers')
      .select('id, name, price, available, sold')
      .eq('id', tierId)
      .eq('event_id', eventId)
      .single();

    if (!tier) {
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });
    }
    if (tier.price !== 0) {
      return NextResponse.json({ error: 'This tier is not free' }, { status: 400 });
    }

    const remaining = tier.available - tier.sold;
    if (remaining < quantity) {
      return NextResponse.json({ error: `Only ${remaining} tickets remaining` }, { status: 400 });
    }

    const email       = buyerEmail.toLowerCase().trim();
    const qty         = Math.max(1, Number(quantity));
    const purchasedAt = new Date().toISOString();
    const consent     = marketingConsent === true;
    // Pseudo-reference for free orders (no Paystack transaction)
    const reference   = `FREE-${randomBytes(6).toString('hex').toUpperCase()}`;

    const ticketIds: string[]   = [];
    const refundCodes: string[] = [];
    for (let i = 0; i < qty; i++) {
      ticketIds.push(generateTicketId());
      refundCodes.push(generateRefundCode());
    }

    const rows = ticketIds.map((id, i) => ({
      id,
      event_id:           eventId,
      tier_id:            tierId,
      organizer_id:       event.organizer_id,
      buyer_name:         buyerName?.trim() || email,
      buyer_email:        email,
      quantity:           1,
      total_paid:         0,
      status:             'valid',
      purchased_at:       purchasedAt,
      refund_code:        refundCodes[i],
      qr_token:           id,
      paystack_reference: reference,
      marketing_consent:  consent,
    }));

    const { error: insertErr } = await db.from('tickets').insert(rows);
    if (insertErr) {
      console.error('POST /api/checkout/free ticket insert error', insertErr);
      return NextResponse.json({ error: 'Failed to create tickets' }, { status: 500 });
    }

    await db.rpc('increment_tier_sold', { tier_id: tierId, amount: qty });

    notify(
      { type: 'organizer', id: event.organizer_id },
      {
        notifType: 'purchase',
        title:     `${qty} free ticket${qty > 1 ? 's' : ''} claimed — ${event.event_name}`,
        body:      `${buyerName?.trim() || email} claimed ${qty} × ${tier.name} (free)`,
        link:      '/organizer/dashboard',
      },
    ).catch(console.error);

    sendTicketEmail({
      to:          email,
      buyerName:   buyerName?.trim() || '',
      tickets:     ticketIds.map((id, i) => ({ ticketId: id, refundCode: refundCodes[i] })),
      paystackRef: reference,
      eventName:   event.event_name,
      eventDate:   event.date,
      eventVenue:  event.venue,
      tierName:    tier.name,
      totalPaid:   0,
    }).catch(err => console.error('free checkout: email error', err));

    return NextResponse.json({
      success: true,
      data: { ticketId: ticketIds[0], reference },
    });
  } catch (err) {
    console.error('POST /api/checkout/free error', err);
    return NextResponse.json({ error: 'Failed to process free checkout' }, { status: 500 });
  }
}
