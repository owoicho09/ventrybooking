// Buyer-facing service fee: 2% of ticket price, capped at a flat ₦3,000 per
// ticket once the price crosses ₦150,000 (2% of ₦150,000 is exactly ₦3,000,
// so the two rules meet at the threshold with no jump).
export const SERVICE_FEE_RATE      = 0.02;
export const SERVICE_FEE_THRESHOLD = 150_000;
export const SERVICE_FEE_FLAT      = 3_000;

/** Organizer-facing platform fee: 2.5% of gross ticket revenue, deducted before payout. */
export const PLATFORM_FEE_RATE = 0.025;

/** Buyer service fee for a single ticket at this price. */
export function serviceFeePerTicket(ticketPrice: number) {
  return Math.min(Math.round(ticketPrice * SERVICE_FEE_RATE), SERVICE_FEE_FLAT);
}

/** Full buyer-facing total: ticket subtotal + service fee. */
export function buyerTotal(ticketPrice: number, quantity: number) {
  const subtotal   = ticketPrice * quantity;
  const serviceFee = serviceFeePerTicket(ticketPrice) * quantity;
  const total      = subtotal + serviceFee;
  return { subtotal, serviceFee, total };
}

/**
 * Recovers the refundable base ticket price from what a buyer actually paid
 * for ONE ticket, reversing whichever fee rule (2% or flat ₦3,000) applied.
 * Total paid at/below the threshold's break-even point (₦153,000) came from
 * the 2% rule; above it, the flat ₦3,000 rule applied.
 */
export function basePriceFromTotalPaid(totalPaid: number) {
  const flatBreakEven = SERVICE_FEE_THRESHOLD * (1 + SERVICE_FEE_RATE);
  if (totalPaid > flatBreakEven) return totalPaid - SERVICE_FEE_FLAT;
  return Math.round(totalPaid / (1 + SERVICE_FEE_RATE));
}
