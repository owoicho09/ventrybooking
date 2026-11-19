// Per-event fee split (062). Ventry's fee is 5% of the ticket price; the
// organiser chooses who pays it. Shared by the create/edit forms (labels,
// previews) and the server (stored rates).

/**
 * Off until the client signs off: organisers can't pick a split, and new
 * events are stored exactly as before 062 (no split, buyer 2%, the
 * organiser's own host rate). Settlement and checkout support stays in place.
 */
export const FEE_SPLIT_ENABLED = false;

export type FeeSplit = 'buyer_5' | 'host_5' | 'even' | 'host3_buyer2' | 'host2_buyer3';

/** The long-standing arrangement: buyer 2%, host 3%. */
export const DEFAULT_FEE_SPLIT: FeeSplit = 'host3_buyer2';
/** The standard host rate a custom organiser rate is measured against. */
export const STANDARD_HOST_RATE = 0.03;
export const DEFAULT_BUYER_RATE = 0.02;

export const FEE_SPLITS: { value: FeeSplit; label: string; buyer: number; host: number }[] = [
  { value: 'host3_buyer2', label: '3% to you, 2% to buyer', buyer: 0.02,  host: 0.03 },
  { value: 'host2_buyer3', label: '2% to you, 3% to buyer', buyer: 0.03,  host: 0.02 },
  { value: 'even',         label: 'Split evenly (2.5% each)', buyer: 0.025, host: 0.025 },
  { value: 'buyer_5',      label: 'Full 5% to buyer',        buyer: 0.05,  host: 0 },
  { value: 'host_5',       label: 'Full 5% to you (host)',   buyer: 0,     host: 0.05 },
];

export function isFeeSplit(v: unknown): v is FeeSplit {
  return FEE_SPLITS.some(s => s.value === v);
}

const r5 = (n: number) => Math.round(n * 100000) / 100000;

/**
 * Effective rates for a split. An organiser whose own rate differs from the
 * standard 3% (e.g. grandfathered at 2.5%) keeps that difference, applied to
 * the host share first and to the buyer share only if the host share runs
 * out. With the default split this reproduces their current rates exactly.
 */
export function feeRatesFor(split: FeeSplit, organizerRate?: number | null): { buyer: number; host: number } {
  const base = FEE_SPLITS.find(s => s.value === split) ?? FEE_SPLITS[0];
  const delta = (organizerRate ?? STANDARD_HOST_RATE) - STANDARD_HOST_RATE; // negative = discount
  let host = base.host + delta;
  let buyer = base.buyer;
  if (host < 0) { buyer = Math.max(0, buyer + host); host = 0; }
  return { buyer: r5(buyer), host: r5(host) };
}

/** "2.5%" */
export function pct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
