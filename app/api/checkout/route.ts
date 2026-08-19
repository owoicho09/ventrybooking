import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { initializeTransaction } from '@/lib/server/paystack';
import { buyerTotalForItems } from '@/lib/server/fees';
import { v4 as uuidv4 } from 'uuid';

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
    // A tier can't appear twice — the buyer should have adjusted one quantity instead.
    if (new Set(cartItems.map(i => i.tierId)).size !== cartItems.length) {
      return NextResponse.json({ error: 'Duplicate ticket tier in order' }, { status: 400 });
    }

    const db = getServerSupabase();

    // Verify event is approved
    const { data: event, error: eventErr } = await db
      .from('events')
      .select('id, event_name, status, organizer_id')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr) {
      console.error('POST /api/checkout event lookup error:', eventErr);
      return NextResponse.json({ error: 'Failed to verify event' }, { status: 500 });
    }
    if (!event || event.status !== 'approved') {
      return NextResponse.json({ error: 'Event is not available for purchase' }, { status: 400 });
    }

    // Get every requested tier and check availability. Fetched in one query
    // so a single missing/foreign tier can't sneak a wrong price through.
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
      const remaining = tier.available - tier.sold;
      if (remaining < item.quantity) {
        return NextResponse.json({ error: `Only ${remaining} of "${tier.name}" remaining` }, { status: 400 });
      }
    }

    const { subtotal, serviceFee, processingFee, total } = buyerTotalForItems(
      cartItems.map(i => ({ price: tierById.get(i.tierId)!.price, quantity: i.quantity })),
    );
    if (total === 0) {
      return NextResponse.json({ error: 'Use the free checkout endpoint for free tickets' }, { status: 400 });
    }

    const reference = `VTR-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 12)}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    // Only attribute to an affiliate whose code actually belongs to this event.
    let refCode: string | undefined;
    if (ref) {
      const { data: affiliate, error: refErr } = await db
        .from('affiliates')
        .select('code')
        .eq('code', ref)
        .eq('event_id', eventId)
        .maybeSingle();
      if (refErr) console.error('POST /api/checkout: affiliate lookup error', refErr);
      if (affiliate) refCode = affiliate.code;
    }

    // Initialize Paystack transaction
    const paystackData = await initializeTransaction({
      email: buyerEmail,
      amount: total * 100, // kobo
      reference,
      callback_url: `${appUrl}/api/paystack/callback?ref=${reference}`,
      metadata: {
        eventId,
        items: cartItems.map(i => ({ tierId: i.tierId, quantity: i.quantity })),
        buyerEmail,
        buyerName:        buyerName || '',
        marketingConsent: marketingConsent === true,
        subtotal,
        serviceFee,
        processingFee,
        total,
        refCode,
      },
    });

    // Create a pending order record — non-critical; webhook is source of truth.
    // One row per event covers the whole cart via the `items` JSONB column;
    // tier_id/quantity are kept populated with the first line for any code
    // that still reads those columns directly.
    try {
      await db.from('pending_orders').insert({
        reference,
        event_id:          eventId,
        tier_id:           cartItems[0].tierId,
        quantity:          cartItems[0].quantity,
        items:             cartItems.map(i => ({ tier_id: i.tierId, quantity: i.quantity })),
        buyer_email:       buyerEmail,
        buyer_name:        buyerName || '',
        subtotal,
        service_fee:       serviceFee,
        processing_fee:    processingFee,
        total,
        organizer_id:      event.organizer_id,
        marketing_consent: marketingConsent === true,
        created_at:        new Date().toISOString(),
      });
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: paystackData.authorization_url,
        reference,
      },
    });
  } catch (err) {
    console.error('POST /api/checkout error', err);
    return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 });
  }
}
