const PLATFORM_FEE_RATE    = 0.025; // 2.5%  Ventry platform fee (deducted from organizer payout)
export const PAYSTACK_FEE_RATE = 0.015; // 1.5%  Paystack fee deducted by Paystack from settlement — not charged to buyer
export const SERVICE_FEE       = 100;   // ₦100  Ventry flat service fee (charged to buyer, non-refundable)

/** Full buyer-facing total: ticket subtotal + flat service fee only. */
export function buyerTotal(ticketPrice: number, quantity: number) {
  const subtotal   = ticketPrice * quantity;
  const serviceFee = SERVICE_FEE;
  const total      = subtotal + serviceFee;
  return { subtotal, serviceFee, total };
}

/** Platform fee deducted from organizer gross payout (2.5%). */
export function calculateFees(grossAmount: number) {
  const fee = Math.round(grossAmount * PLATFORM_FEE_RATE);
  const net = grossAmount - fee;
  return { gross: grossAmount, fee, net };
}
