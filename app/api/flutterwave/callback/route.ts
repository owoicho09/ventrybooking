import { NextRequest, NextResponse } from 'next/server';
import { findFlutterwaveTransaction, verifyFlutterwaveTransaction } from '@/lib/server/flutterwave';
import { createTicketFromFlutterwavePayment } from '@/lib/server/flutterwaveCheckout';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('tx_ref') || searchParams.get('ref');
  if (!reference) return NextResponse.redirect(new URL('/events', req.url));

  try {
    const transactionId = searchParams.get('transaction_id');
    const transaction = transactionId
      ? await verifyFlutterwaveTransaction(transactionId)
      : await findFlutterwaveTransaction(reference);

    if (transaction?.status === 'successful' && transaction.tx_ref === reference) {
      const ticketId = await createTicketFromFlutterwavePayment(reference, transaction);
      if (ticketId) return NextResponse.redirect(new URL(`/ticket/${ticketId}?new=1`, req.url));
      return NextResponse.redirect(new URL(`/payment/pending?ref=${encodeURIComponent(reference)}`, req.url));
    }

    const reason = encodeURIComponent(transaction?.processor_response || 'Payment was not completed');
    return NextResponse.redirect(new URL(`/payment/failed?reason=${reason}`, req.url));
  } catch (err) {
    console.error('Flutterwave callback verify error:', err);
    return NextResponse.redirect(new URL(`/payment/pending?ref=${encodeURIComponent(reference)}`, req.url));
  }
}
// Ticket creation can render IJGB visa tickets and send the ticket email
// (with retries) inside this request.
export const maxDuration = 60;
