// Buyer-facing service fee: 2% of ticket price, capped at a flat ₦3,000 per
// ticket once the price crosses ₦150,000 (2% of ₦150,000 is exactly ₦3,000,
// so the two rules meet at the threshold with no jump).
export const SERVICE_FEE_RATE      = 0.02;
export const SERVICE_FEE_THRESHOLD = 150_000;
export const SERVICE_FEE_FLAT      = 3_000;

/** Organizer-facing platform fee: 3% of gross ticket revenue, deducted before payout. */
export const PLATFORM_FEE_RATE = 0.03;

// Processing fee: the payment processor charges 1.5% of the final total,
// plus a flat ₦100 once the total reaches ₦2,500, capped at ₦2,000. Since
// the fee is charged on the final total (not the pre-fee amount), the total
// must be grossed up rather than having the fee simply added on top.
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
 * fee), solved so the processor's cut of the *grossed-up* total equals this
 * fee exactly. Returns the unrounded fee — round only the final total.
 */
export function processingFee(preProcessingAmount: number): number {
  if (preProcessingAmount <= 0) return 0;
  const grossed = preProcessingAmount < PROCESSING_FEE_THRESHOLD
    ? preProcessingAmount / (1 - PROCESSING_FEE_RATE)
    : (preProcessingAmount + PROCESSING_FEE_FLAT) / (1 - PROCESSING_FEE_RATE);
  return Math.min(grossed - preProcessingAmount, PROCESSING_FEE_CAP);
}

/**
 * Full buyer-facing total: ticket subtotal + service fee + processing fee.
 * The total is rounded to the nearest Naira (money is displayed whole-Naira
 * throughout the app); the displayed processing fee is derived as the
 * remainder so the four displayed lines always sum exactly to the total,
 * and the amount sent to the payment processor is always a clean integer.
 */
export function buyerTotalWithProcessing(ticketPrice: number, quantity: number) {
  const subtotal            = ticketPrice * quantity;
  const serviceFee          = serviceFeePerTicket(ticketPrice) * quantity;
  const preProcessingAmount = subtotal + serviceFee;
  const total               = Math.round(preProcessingAmount + processingFee(preProcessingAmount));
  return { subtotal, serviceFee, processingFee: total - preProcessingAmount, total };
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
