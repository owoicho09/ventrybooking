import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/server/paystack';
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
    const { reference, metadata, amount, customer } = event.data;
    const { eventId, tierId, buyerEmail, buyerName } = metadata || {};
    const quantity = Number(metadata?.quantity) || 1;

    if (!eventId || !tierId) {
      console.error('Webhook: missing eventId or tierId in metadata', { reference });
      return NextResponse.json({ success: true }); // 200 — retrying won't help
    }

    try {
      await createTicketFromPayment({
        reference,
        eventId,
        tierId,
        quantity,
        totalPaidKobo: amount,
        buyerEmail,
        buyerName,
        customerEmail: customer?.email,
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

  // Idempotent: only update if not already completed (webhook may fire more than once)
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

  // Reset to processing and clear the reference so admin can retry the release.
  // Clearing reference is required because the release route uses `reference IS NULL`
  // as a distributed lock — without this, the payout would be permanently stuck.
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
  ).catch(err => console.error(`${eventType}: notify error`, err));
}
