import { NextRequest, NextResponse } from 'next/server';
import {
  findFlutterwaveTransaction,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhookHash,
} from '@/lib/server/flutterwave';
import { createTicketFromFlutterwavePayment } from '@/lib/server/flutterwaveCheckout';

export async function POST(req: NextRequest) {
  if (!verifyFlutterwaveWebhookHash(req.headers.get('verif-hash') || '')) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { event?: string; data?: { id?: string | number; tx_ref?: string; status?: string } };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (event.event !== 'charge.completed' || event.data?.status !== 'successful') {
    return NextResponse.json({ success: true });
  }

  const reference = event.data.tx_ref;
  if (!reference?.startsWith('VTF-')) return NextResponse.json({ success: true });

  try {
    const transaction = event.data.id
      ? await verifyFlutterwaveTransaction(event.data.id)
      : await findFlutterwaveTransaction(reference);
    if (transaction?.status !== 'successful' || transaction.tx_ref !== reference) {
      console.error('Flutterwave webhook: verification did not match successful payment', reference);
      return NextResponse.json({ success: true });
    }

    const ticketId = await createTicketFromFlutterwavePayment(reference, transaction);
    if (!ticketId) return NextResponse.json({ error: 'Ticket creation failed' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Flutterwave webhook processing error:', reference, err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
// Ticket creation can render IJGB visa tickets and send the ticket email
// (with retries) inside this request.
export const maxDuration = 60;
