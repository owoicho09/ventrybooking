const PLATFORM_FEE_RATE    = 0.025; // 2.5%  Ventry platform fee (deducted from organizer payout)
export const PAYSTACK_FEE_RATE = 0.015; // 1.5%  Paystack processing fee (charged to buyer, non-refundable)
export const SERVICE_FEE       = 100;   // ₦100  Ventry flat service fee (charged to buyer, non-refundable)

/** Paystack processing fee on a given subtotal (1.5%, rounded to nearest naira). */
export function paystackFee(subtotal: number): number {
  return Math.round(subtotal * PAYSTACK_FEE_RATE);
}

/** Full buyer-facing total with all fee components broken out. */
export function buyerTotal(ticketPrice: number, quantity: number) {
  const subtotal      = ticketPrice * quantity;
  const serviceFee    = SERVICE_FEE;
  const processingFee = paystackFee(subtotal);
  const total         = subtotal + serviceFee + processingFee;
  return { subtotal, serviceFee, processingFee, total };
}

/** Platform fee deducted from organizer gross payout (2.5%). */
export function calculateFees(grossAmount: number) {
  const fee = Math.round(grossAmount * PLATFORM_FEE_RATE);
  const net = grossAmount - fee;
  return { gross: grossAmount, fee, net };
}
