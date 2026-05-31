import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/server/paystack';
import { createTicketFromPayment } from '@/lib/server/ticket';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-paystack-signature') || '';
  const body = await req.text();

  if (!verifyWebhookSignature(body, signature)) {
    console.error('Webhook: invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);

  if (event.event !== 'charge.success') {
    return NextResponse.json({ success: true });
  }

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
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Webhook: createTicketFromPayment error', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
