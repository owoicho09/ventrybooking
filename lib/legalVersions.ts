// Single source of truth for legal document versions and effective dates.
// Every acceptance checkbox and every legal page imports from here so a
// document update is one edit, not a hunt through twenty hardcoded strings —
// and so we can always prove which version governed a given signup.
//
// These describe the next-working-day settlement / identity verification /
// claim list model (stated effective 15 September 2026). Publishing this
// content ahead of those features actually shipping was a deliberate,
// explicitly-confirmed call — the site now states obligations (verification,
// settlement timing, claim process) the platform doesn't fully implement yet.
export const LEGAL_VERSIONS = {
  organiserTerms:  { version: '2.0', effective: '15 September 2026' },
  buyerTerms:       { version: '2.0', effective: '15 September 2026' },
  affiliatePolicy:  { version: '1.0', effective: '15 September 2026' },
} as const;
