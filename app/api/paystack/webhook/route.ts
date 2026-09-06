import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, verifyTransaction } from '@/lib/server/paystack';
import { createTicketFromPayment } from '@/lib/server/ticket';
import { getServerSupabase } from '@/lib/supabase/server';
import { notify } from '@/lib/server/notify';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-paystack-signature') || '';
  const body = await req.text();

  if (!verifyWebhookSignature(body, signature)) {
    console.error('Webhook: invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);

  if (event.event === 'charge.success') {
    const { reference } = event.data;

    // The webhook payload's own event.data.metadata is empirically unreliable
    // — it arrives empty on a large fraction of real transactions even though
    // the charge was correctly initialized with metadata, for reasons outside
    // our control. Paystack's /transaction/verify REST endpoint does not have
    // this problem (reconcile.ts has relied on it for every recovery), so
    // verify immediately instead of trusting the webhook body — this is what
    // actually fixes tickets being created only 15–35 minutes late via the
    // reconcile cron instead of instantly here.
    let verified;
    try {
      verified = await verifyTransaction(reference);
    } catch (err) {
      console.error('Webhook: verifyTransaction failed, leaving for reconcile cron', reference, err);
      return NextResponse.json({ success: true });
    }

    if (verified?.status !== 'success') {
      console.error('Webhook: verify did not confirm a successful charge', { reference, status: verified?.status });
      return NextResponse.json({ success: true });
    }

    const metadata = verified.metadata || {};
    let { eventId, items, buyerEmail, buyerName } = metadata;
    const { refCode, purchasedByEmail } = metadata;
    let marketingConsent = metadata?.marketingConsent === true;
    let ventryMarketingConsent = metadata?.ventryMarketingConsent === true;
    let declaredTotal = Number(metadata?.total);
    const customerEmail = verified.customer?.email;

    // Belt-and-suspenders: fall back to the checkout-time record in
    // pending_orders if even the verify call somehow comes back without our
    // metadata (e.g. the transaction was initialized without it reaching
    // Paystack at all). Same fallback reconcilePendingOrders() uses.
    if (!eventId || !Array.isArray(items) || items.length === 0) {
      const db = getServerSupabase();
      const { data: order } = await db
        .from('pending_orders')
        .select('*')
        .eq('reference', reference)
        .maybeSingle();

      if (order) {
        eventId = order.event_id;
        items = Array.isArray(order.items) && order.items.length > 0
          ? order.items.map((i: { tier_id: string; quantity: number }) => ({ tierId: i.tier_id, quantity: i.quantity }))
          : [{ tierId: order.tier_id, quantity: order.quantity }];
        buyerEmail = buyerEmail || order.buyer_email;
        buyerName  = buyerName  || order.buyer_name;
        marketingConsent = marketingConsent || order.marketing_consent;
        ventryMarketingConsent = ventryMarketingConsent || order.ventry_marketing_consent;
        if (!Number.isFinite(declaredTotal) || declaredTotal <= 0) declaredTotal = Number(order.total);
      }
    }

    if (!eventId || !Array.isArray(items) || items.length === 0) {
      console.error('Webhook: missing eventId or items after verify and pending_orders fallback', { reference });
      notify(
        { type: 'admin' },
        {
          notifType: 'ticket_creation_failed',
          title:     `Ticket creation failed — ${reference}`,
          body:      `Payment succeeded but metadata was missing eventId/tierId, and no matching checkout record was found either, so no ticket could be created. Buyer: ${buyerEmail || customerEmail || 'unknown'}.`,
          link:      `/admin/buyers?search=${encodeURIComponent(buyerEmail || customerEmail || '')}`,
        },
      ).catch(err => console.error('Webhook: notify-admin error', err));
      return NextResponse.json({ success: true }); // 200 — retrying won't help
    }

    // Paystack's `amount` is what was actually deducted from the customer's card,
    // which can run 1.5–3%+ higher than what we charged them for — Paystack adds its
    // own processing fee on top when the fee bearer is the customer. Recording that
    // inflated figure as total_paid corrupts every downstream use of it (the "Total
    // Paid" shown in the ticket email, and refund amounts). `metadata.total` (or,
    // failing that, pending_orders.total above) is the exact subtotal+serviceFee we
    // requested at checkout, so prefer that and only fall back to the verified
    // `amount` if both are somehow missing it.
    const totalPaidKobo = Number.isFinite(declaredTotal) && declaredTotal > 0
      ? Math.round(declaredTotal * 100)
      : verified.amount;

    try {
      await createTicketFromPayment({
        reference,
        eventId,
        items,
        totalPaidKobo,
        buyerEmail,
        buyerName,
        customerEmail,
        marketingConsent,
        ventryMarketingConsent,
        refCode,
        purchasedByEmail,
      });
    } catch (err) {
      console.error('Webhook: createTicketFromPayment error', err);
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (event.event === 'transfer.success') {
    await handleTransferSuccess(event.data).catch(err =>
      console.error('Webhook: transfer.success handler error', err),
    );
    return NextResponse.json({ success: true });
  }

  if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
    await handleTransferFailure(event.data, event.event as string).catch(err =>
      console.error(`Webhook: ${event.event} handler error`, err),
    );
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

async function handleTransferSuccess(data: { reference: string; amount: number }) {
  const db = getServerSupabase();

  const { data: payout } = await db
    .from('payouts')
    .select('id, organizer_id, event_name')
    .eq('reference', data.reference)
    .maybeSingle();

  if (!payout) {
    console.error('transfer.success: no payout found for reference', data.reference);
    return;
  }

  await db
    .from('payouts')
    .update({ status: 'completed' })
    .eq('id', payout.id)
    .in('status', ['otp_pending', 'processing']);

  notify(
    { type: 'organizer', id: payout.organizer_id },
    {
      notifType: 'payout',
      title:     `Payout confirmed — ${payout.event_name}`,
      body:      `${fmt(data.amount / 100)} has been sent to your bank account.`,
      link:      '/organizer/payouts',
    },
  ).catch(err => console.error('transfer.success: notify organizer error', err));

  notify(
    { type: 'admin' },
    {
      notifType: 'payout',
      title:     `Payout completed — ${payout.event_name}`,
      body:      `Paystack confirmed transfer of ${fmt(data.amount / 100)} to organizer's bank account.`,
      link:      '/admin/payouts',
    },
  ).catch(err => console.error('transfer.success: notify admin error', err));
}

async function handleTransferFailure(data: { reference: string }, eventType: string) {
  const db = getServerSupabase();

  const { data: payout } = await db
    .from('payouts')
    .select('id, organizer_id, event_name')
    .eq('reference', data.reference)
    .maybeSingle();

  if (!payout) {
    console.error(`${eventType}: no payout found for reference`, data.reference);
    return;
  }

  await db
    .from('payouts')
    .update({ status: 'processing', reference: null })
    .eq('id', payout.id);

  const isReversed = eventType === 'transfer.reversed';

  notify(
    { type: 'admin' },
    {
      notifType: 'payout',
      title:     `Transfer ${isReversed ? 'reversed' : 'failed'} — action required`,
      body:      `Payout for "${payout.event_name}" was ${isReversed ? 'reversed' : 'rejected'} by Paystack. It has been reset to processing for retry.`,
      link:      '/admin/payouts',
    },
    { emailChannel: 'immediate' },
  ).catch(err => console.error(`${eventType}: notify error`, err));
}
