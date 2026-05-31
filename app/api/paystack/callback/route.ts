import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/server/paystack';
import { createTicketFromPayment } from '@/lib/server/ticket';

export async function GET(req: NextRequest) {
  // Paystack appends ?reference=xxx&trxref=xxx to our callback_url.
  // We also store ?ref=xxx in the callback_url as a fallback.
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || searchParams.get('ref');

  if (!reference) {
    return NextResponse.redirect(new URL('/events', req.url));
  }

  try {
    const tx = await verifyTransaction(reference);

    if (tx?.status === 'success') {
      const { metadata, amount, customer } = tx;
      const { eventId, tierId, buyerEmail, buyerName } = metadata || {};
      const quantity = Math.max(1, Number(metadata?.quantity) || 1);

      if (eventId && tierId) {
        const ticketId = await createTicketFromPayment({
          reference,
          eventId,
          tierId,
          quantity,
          totalPaidKobo: amount,
          buyerEmail,
          buyerName,
          customerEmail: customer?.email,
        });

        if (ticketId) {
          return NextResponse.redirect(new URL(`/ticket/${ticketId}`, req.url));
        }
      }

      // Payment confirmed but ticket creation failed — go to pending to retry via webhook
      return NextResponse.redirect(new URL(`/payment/pending?ref=${reference}`, req.url));
    }

    // Payment was abandoned, failed, or reversed
    const reason = encodeURIComponent(tx?.gateway_response || 'Payment was not completed');
    return NextResponse.redirect(new URL(`/payment/failed?reason=${reason}`, req.url));
  } catch (err) {
    console.error('Paystack callback verify error:', err);
    // Network or Paystack API error — fall back to pending so webhook can handle it
    return NextResponse.redirect(new URL(`/payment/pending?ref=${reference}`, req.url));
  }
}
