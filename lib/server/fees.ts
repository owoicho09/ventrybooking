const PLATFORM_FEE_RATE        = 0.03;  // 3%  Ventry platform fee (deducted from organizer payout)
export const PAYSTACK_FEE_RATE = 0.015; // 1.5%  Paystack fee deducted by Paystack from settlement — not charged to buyer
export const SERVICE_FEE_RATE  = 0.02;  // 2%  Ventry service fee on ticket subtotal (charged to buyer, non-refundable)

/** Full buyer-facing total: ticket subtotal + 2% service fee. */
export function buyerTotal(ticketPrice: number, quantity: number) {
  const subtotal   = ticketPrice * quantity;
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
  const total      = subtotal + serviceFee;
  return { subtotal, serviceFee, total };
}

/** Recovers the refundable base ticket price from what a buyer actually paid, reversing the 2% service fee. */
export function basePriceFromTotalPaid(totalPaid: number) {
  return Math.round(totalPaid / (1 + SERVICE_FEE_RATE));
}

/** Platform fee deducted from organizer gross payout (3%). */
export function calculateFees(grossAmount: number) {
  const fee = Math.round(grossAmount * PLATFORM_FEE_RATE);
  const net = grossAmount - fee;
  return { gross: grossAmount, fee, net };
}
