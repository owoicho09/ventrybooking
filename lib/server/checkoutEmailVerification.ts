// Checkout used to email the buyer a code before every guest order. That was
// removed for drop-off (2026-11-20): the checkout page now asks the buyer to
// confirm the address on screen, with a typo suggestion (lib/emailTypos.ts).
// These helpers stay because checkout and the review routes still use them.

export function normalizeCheckoutEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
