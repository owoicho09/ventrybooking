// Buyer-facing service fee before the 062 fee split: 2% of ticket price,
// capped at ₦3,000 per ticket above ₦150,000. Only events created before the
// split (no buyer_fee_rate stored) still use the cap; see buyerFeeUnits.
export const SERVICE_FEE_RATE      = 0.02;
export const SERVICE_FEE_THRESHOLD = 150_000;
export const SERVICE_FEE_FLAT      = 3_000;

/** Organizer-facing platform fee: 3% of gross ticket revenue, deducted before payout. */
export const PLATFORM_FEE_RATE = 0.03;

// Processing fee: 1.5% of the pre-processing amount (ticket subtotal plus
// service fee), plus a flat ₦100 once that amount exceeds ₦2,500, capped at
// ₦2,000. Not a gross-up: the rate applies to the pre-processing amount, not
// to the final total. Never rounded on its own; only the order total is.
export const PROCESSING_FEE_RATE      = 0.015;
export const PROCESSING_FEE_FLAT      = 100;
export const PROCESSING_FEE_THRESHOLD = 2_500;
export const PROCESSING_FEE_CAP       = 2_000;

// ── Exact fee maths (20 Nov 2026 fee spec) ─────────────────────────────────
// Every amount is an integer count of UNIT = 10^-16 kobo, held as a BigInt,
// so no fee is ever rounded before the fees are added together. Only the
// final buyer total is rounded, and always UP to the next whole naira
// (₦10,200.50 → ₦10,201 → 1020100 kobo sent to the payment processor).
//
// buyerRate is the event's buyer share of Ventry's 5% (062). null/undefined
// means an event created before the split existed: 2%, with the old ₦3,000
// cap above ₦150,000 kept so tickets already on sale don't change price.
// Events with a split stored have no cap: a flat percentage of the price.

const KOBO = 10n ** 16n;          // units per kobo
const NAIRA = 100n * KOBO;        // units per naira
const BPS = 10_000n;              // rates are carried in basis points

const toUnits = (naira: number) => BigInt(Math.round(naira * 100)) * KOBO;
// Whole naira stay exact; only the fraction goes through floating point.
const toNaira = (units: bigint) => Number(units / NAIRA) + Number(units % NAIRA) / Number(NAIRA);
const rateBps = (rate: number) => BigInt(Math.round(rate * 10_000));
const ceilNaira = (units: bigint) => (units <= 0n ? 0n : ((units + NAIRA - 1n) / NAIRA) * NAIRA);

function buyerFeeUnits(ticketPrice: number, buyerRate?: number | null): bigint {
  if (ticketPrice <= 0) return 0n;
  const legacy = buyerRate == null;
  const rate = legacy ? SERVICE_FEE_RATE : buyerRate;
  if (!(rate > 0)) return 0n;
  const fee = (toUnits(ticketPrice) * rateBps(rate)) / BPS; // exact: price is whole kobo
  if (!legacy) return fee;
  const cap = toUnits(SERVICE_FEE_FLAT);
  return fee < cap ? fee : cap;
}

function processingUnits(pre: bigint): bigint {
  if (pre <= 0n) return 0n;
  // 1.5% of a whole number of units can leave a fraction of a unit; carry it
  // up rather than drop it (it is 10^-16 kobo, and the total rounds up anyway).
  let raw = (pre * rateBps(PROCESSING_FEE_RATE) + BPS - 1n) / BPS;
  if (pre > toUnits(PROCESSING_FEE_THRESHOLD)) raw += toUnits(PROCESSING_FEE_FLAT);
  const cap = toUnits(PROCESSING_FEE_CAP);
  return raw < cap ? raw : cap;
}

/** The event's buyer rate as stored (062): a number, or null for a pre-split event. */
export function buyerRateOf(ev: { buyerFeeRate?: number | null } | null | undefined): number | null {
  const r = ev?.buyerFeeRate;
  return typeof r === 'number' && Number.isFinite(r) && r >= 0 ? r : null;
}

/** Buyer's share of the service fee for one ticket, unrounded (may hold fractions of a kobo). */
export function serviceFeePerTicket(ticketPrice: number, buyerRate?: number | null): number {
  return toNaira(buyerFeeUnits(ticketPrice, buyerRate));
}

/**
 * Buyer-facing per-ticket price shown on the site: ticket price plus the
 * buyer's share of the fee, rounded up to whole naira. Excludes the
 * processing fee, which depends on the whole order.
 */
export function ticketPriceWithService(ticketPrice: number, buyerRate?: number | null): number {
  if (ticketPrice <= 0) return ticketPrice;
  return toNaira(ceilNaira(toUnits(ticketPrice) + buyerFeeUnits(ticketPrice, buyerRate)));
}

/**
 * The per-ticket price to advertise for a tier. Normally the buyer's share
 * of the fee is folded in; an event set to show prices before fees (060)
 * advertises the exact tier price instead. The amount charged is the same.
 */
export function listedTicketPrice(ticketPrice: number, priceBeforeFees?: boolean | null, buyerRate?: number | null): number {
  return priceBeforeFees ? ticketPrice : ticketPriceWithService(ticketPrice, buyerRate);
}

/**
 * Processing fee on a pre-processing amount (ticket subtotal + service fee):
 * 1.5%, plus ₦100 above ₦2,500, capped at ₦2,000. Unrounded.
 */
export function processingFee(preProcessingAmount: number): number {
  return toNaira(processingUnits(BigInt(Math.round(preProcessingAmount * 1e6)) * (NAIRA / 1_000_000n)));
}

/**
 * Full buyer total for a cart in one order. The service fee is per ticket
 * (each line's own price); the processing fee is computed once on the
 * combined amount, as the processor charges it. Nothing is rounded until
 * the total, which is rounded up to the next whole naira.
 *
 * The displayed lines are whole naira: subtotal is exact, serviceFee is the
 * exact fee rounded to the nearest naira, and processingFee is whatever is
 * left, so the three always add up to the total. totalKobo is what to send
 * to the payment processor.
 */
export function buyerTotalForItems(items: { price: number; quantity: number }[], buyerRate?: number | null) {
  let subtotalU = 0n;
  let serviceU = 0n;
  for (const i of items) {
    const q = BigInt(Math.max(0, Math.floor(i.quantity)));
    subtotalU += toUnits(i.price) * q;
    serviceU += buyerFeeUnits(i.price, buyerRate) * q;
  }
  const pre = subtotalU + serviceU;
  const totalU = ceilNaira(pre + processingUnits(pre));
  const subtotal = toNaira(subtotalU);
  const total = toNaira(totalU);
  let serviceFee = Math.round(toNaira(serviceU));
  if (total - subtotal - serviceFee < 0) serviceFee = Math.floor(toNaira(serviceU));
  return {
    subtotal,
    serviceFee,
    processingFee: Math.max(0, total - subtotal - serviceFee),
    total,
    totalKobo: Number(totalU / KOBO),
    /** Exact, unrounded buyer service fee (naira), for records. */
    serviceFeeExact: toNaira(serviceU),
  };
}

/** Single-tier convenience wrapper around {@link buyerTotalForItems}. */
export function buyerTotalWithProcessing(ticketPrice: number, quantity: number, buyerRate?: number | null) {
  return buyerTotalForItems([{ price: ticketPrice, quantity }], buyerRate);
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
