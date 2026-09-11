// Buyer-facing service fee: 2% of ticket price, capped at a flat ₦3,000 per
// ticket once the price crosses ₦150,000 (2% of ₦150,000 is exactly ₦3,000,
// so the two rules meet at the threshold with no jump).
export const SERVICE_FEE_RATE      = 0.02;
export const SERVICE_FEE_THRESHOLD = 150_000;
export const SERVICE_FEE_FLAT      = 3_000;

/** Organizer-facing platform fee: 3% of gross ticket revenue, deducted before payout. */
export const PLATFORM_FEE_RATE = 0.03;

// Processing fee: 1.5% of the pre-processing amount (ticket subtotal plus
// service fee), plus a flat ₦100 once that amount exceeds ₦2,500, capped at
// ₦2,000 and rounded up to the next whole naira. Not a gross-up — the rate
// applies directly to the pre-processing amount, not to the final total.
export const PROCESSING_FEE_RATE      = 0.015;
export const PROCESSING_FEE_FLAT      = 100;
export const PROCESSING_FEE_THRESHOLD = 2_500;
export const PROCESSING_FEE_CAP       = 2_000;

/** Buyer service fee for a single ticket at this price. */
export function serviceFeePerTicket(ticketPrice: number) {
  return Math.min(Math.round(ticketPrice * SERVICE_FEE_RATE), SERVICE_FEE_FLAT);
}

/**
 * Processing fee owed on a pre-processing amount (ticket subtotal + service
 * fee): 1.5% of that amount, plus a flat ₦100 above the ₦2,500 threshold,
 * capped at ₦2,000, rounded up to the next whole naira.
 */
export function processingFee(preProcessingAmount: number): number {
  if (preProcessingAmount <= 0) return 0;
  const raw = preProcessingAmount * PROCESSING_FEE_RATE
    + (preProcessingAmount > PROCESSING_FEE_THRESHOLD ? PROCESSING_FEE_FLAT : 0);
  return Math.ceil(Math.min(raw, PROCESSING_FEE_CAP));
}

/**
 * Full buyer-facing total for a cart of one or more ticket tiers in a single
 * order. The service fee is still per-ticket (each line's own price), but
 * the processing fee is computed once on the combined pre-processing
 * amount — Paystack's rate/threshold/cap apply to the one amount actually
 * charged, not to each tier independently. The total is rounded to the
 * nearest Naira; the displayed processing fee is derived as the remainder
 * so the four displayed lines always sum exactly to the total, and the
 * amount sent to the payment processor is always a clean integer.
 */
export function buyerTotalForItems(items: { price: number; quantity: number }[]) {
  const subtotal            = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const serviceFee          = items.reduce((s, i) => s + serviceFeePerTicket(i.price) * i.quantity, 0);
  const preProcessingAmount = subtotal + serviceFee;
  const total               = Math.round(preProcessingAmount + processingFee(preProcessingAmount));
  return { subtotal, serviceFee, processingFee: total - preProcessingAmount, total };
}

/** Single-tier convenience wrapper around {@link buyerTotalForItems}. */
export function buyerTotalWithProcessing(ticketPrice: number, quantity: number) {
  return buyerTotalForItems([{ price: ticketPrice, quantity }]);
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
