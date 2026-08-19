import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { generateTicketId, generateRefundCode } from '@/lib/server/ids';
import { sendTicketEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';
import { randomBytes } from 'crypto';

interface CartItem { tierId: string; quantity: number }

export async function POST(req: NextRequest) {
  try {
    const { eventId, items, buyerEmail, buyerName, marketingConsent, ref } = await req.json();

    if (!eventId || !Array.isArray(items) || items.length === 0 || !buyerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const cartItems = items as CartItem[];
    for (const item of cartItems) {
      if (!item.tierId || !item.quantity || item.quantity < 1 || item.quantity > 10) {
        return NextResponse.json({ error: 'Each ticket tier must have a quantity between 1 and 10' }, { status: 400 });
      }
    }
    if (new Set(cartItems.map(i => i.tierId)).size !== cartItems.length) {
      return NextResponse.json({ error: 'Duplicate ticket tier in order' }, { status: 400 });
    }

    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('id, event_name, date, time, event_mode, venue, status, organizer_id, banner_url')
      .eq('id', eventId)
      .maybeSingle();

    if (!event || event.status !== 'approved') {
      return NextResponse.json({ error: 'Event is not available' }, { status: 400 });
    }

    const { data: tiers } = await db
      .from('ticket_tiers')
      .select('id, name, price, available, sold')
      .in('id', cartItems.map(i => i.tierId))
      .eq('event_id', eventId);

    const tierById = new Map((tiers ?? []).map(t => [t.id, t]));
    for (const item of cartItems) {
      const tier = tierById.get(item.tierId);
      if (!tier) {
        return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });
      }
      if (tier.price !== 0) {
        return NextResponse.json({ error: `"${tier.name}" is not free — checkout requires payment` }, { status: 400 });
      }
      const remaining = tier.available - tier.sold;
      if (remaining < item.quantity) {
        return NextResponse.json({ error: `Only ${remaining} of "${tier.name}" remaining` }, { status: 400 });
      }
    }

    const email       = buyerEmail.toLowerCase().trim();
    const purchasedAt = new Date().toISOString();
    const consent     = marketingConsent === true;
    // Pseudo-reference for free orders (no Paystack transaction)
    const reference   = `FREE-${randomBytes(6).toString('hex').toUpperCase()}`;

    const ticketIds: string[]   = [];
    const refundCodes: string[] = [];
    const rows: Record<string, unknown>[] = [];
    for (const item of cartItems) {
      for (let i = 0; i < item.quantity; i++) {
        const id = generateTicketId();
        const refundCode = generateRefundCode();
        ticketIds.push(id);
        refundCodes.push(refundCode);
        rows.push({
          id,
          event_id:           eventId,
          tier_id:            item.tierId,
          organizer_id:       event.organizer_id,
          buyer_name:         buyerName?.trim() || email,
          buyer_email:        email,
          quantity:           1,
          total_paid:         0,
          status:             'valid',
          purchased_at:       purchasedAt,
          refund_code:        refundCode,
          qr_token:           id,
          paystack_reference: reference,
          marketing_consent:  consent,
        });
      }
    }

    const { error: insertErr } = await db.from('tickets').insert(rows);
    if (insertErr) {
      console.error('POST /api/checkout/free ticket insert error', insertErr);
      return NextResponse.json({ error: 'Failed to create tickets' }, { status: 500 });
    }

    await Promise.all(
      cartItems.map(item => db.rpc('increment_tier_sold', { tier_id: item.tierId, amount: item.quantity })),
    );

    // Free orders never touch Paystack/the webhook, so credit the affiliate here —
    // one buy per completed order, not per ticket. Only if the ref actually
    // belongs to this event.
    if (ref) {
      try {
        const { data: affiliate, error: lookupErr } = await db
          .from('affiliates')
          .select('code')
          .eq('code', ref)
          .eq('event_id', eventId)
          .maybeSingle();
        if (lookupErr) console.error('free checkout: affiliate lookup rpc error', lookupErr);
        if (affiliate) {
          (async () => {
            try {
              const { error } = await db.rpc('increment_affiliate_buys', { p_code: affiliate.code, p_amount: 1 });
              if (error) console.error('free checkout: affiliate credit rpc error', error);
            } catch (err) {
              console.error('free checkout: affiliate credit error', err);
            }
          })();
        }
      } catch (err) {
        console.error('free checkout: affiliate lookup error', err);
      }
    }

    const totalQty = cartItems.reduce((s, i) => s + i.quantity, 0);
    const tierSummary = cartItems.map(i => `${i.quantity} × ${tierById.get(i.tierId)!.name}`).join(', ');

    notify(
      { type: 'organizer', id: event.organizer_id },
      {
        notifType: 'purchase',
        title:     `${totalQty} free ticket${totalQty > 1 ? 's' : ''} claimed — ${event.event_name}`,
        body:      `${buyerName?.trim() || email} claimed ${tierSummary} (free)`,
        link:      '/organizer/dashboard',
      },
    ).catch(console.error);

    sendTicketEmail({
      to:          email,
      buyerName:   buyerName?.trim() || '',
      tickets:     rows.map((r, i) => ({
        ticketId:   ticketIds[i],
        refundCode: refundCodes[i],
        tierName:   tierById.get(r.tier_id as string)!.name,
      })),
      paystackRef: reference,
      eventName:   event.event_name,
      eventDate:   event.date,
      eventVenue:  event.venue,
      eventMode:   event.event_mode,
      totalPaid:   0,
      bannerUrl:   event.banner_url,
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
