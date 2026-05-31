import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { initializeTransaction } from '@/lib/server/paystack';
import { SERVICE_FEE, paystackFee } from '@/lib/server/fees';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const { eventId, tierId, quantity, buyerEmail, buyerName } = await req.json();

    if (!eventId || !tierId || !quantity || !buyerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (quantity < 1 || quantity > 10) {
      return NextResponse.json({ error: 'Quantity must be between 1 and 10' }, { status: 400 });
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

    // Get tier and check availability
    const { data: tier } = await db
      .from('ticket_tiers')
      .select('id, name, price, available, sold')
      .eq('id', tierId)
      .eq('event_id', eventId)
      .single();

    if (!tier) {
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });
    }

    const remaining = tier.available - tier.sold;
    if (remaining < quantity) {
      return NextResponse.json({ error: `Only ${remaining} tickets remaining` }, { status: 400 });
    }

    const subtotal      = tier.price * quantity;
    const processingFee = paystackFee(subtotal);
    const total         = subtotal + SERVICE_FEE + processingFee;
    const reference = `VTR-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 12)}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    // Initialize Paystack transaction
    const paystackData = await initializeTransaction({
      email: buyerEmail,
      amount: total * 100, // kobo
      reference,
      callback_url: `${appUrl}/api/paystack/callback?ref=${reference}`,
      metadata: {
        eventId,
        tierId,
        quantity,
        buyerEmail,
        buyerName:     buyerName || '',
        subtotal,
        serviceFee:    SERVICE_FEE,
        processingFee,
        total,
      },
    });

    // Create a pending order record — non-critical; webhook is source of truth
    try {
      await db.from('pending_orders').insert({
        reference,
        event_id: eventId,
        tier_id: tierId,
        quantity,
        buyer_email: buyerEmail,
        buyer_name: buyerName || '',
        subtotal,
        service_fee:    SERVICE_FEE,
        total,
        organizer_id: event.organizer_id,
        created_at: new Date().toISOString(),
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
