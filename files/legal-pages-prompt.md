# Ventry Update — Legal Pages

You are working on Ventry (ventrybooking.com), a live Nigerian event ticketing platform. Next.js App Router, Supabase, Vercel. The client has issued new legal documents that must now live on the site, replacing whatever terms/refund content exists today.

Three source files are in `docs/legal/` in this repo:

- `buyer-terms.md` — Ventry Buyer Terms of Use, v1.0, effective 16 August 2026
- `organiser-terms.md` — Ventry Organiser Terms of Use, v1.0, effective 16 August 2026
- `refund-policy.md` — Ventry Refund Policy, v2.0, effective 16 August 2026

## The one rule that matters most

**These are legal documents. Publish their text verbatim.** Do not rewrite, shorten, paraphrase, "improve", or summarise any clause. Every number, window, fee, table, and worked example must appear on the page exactly as written in the source files. Your job is presentation and routing, not editing. If you find something in a source file that contradicts how the platform actually behaves, flag it to me — do not silently change either side.

## Goal 1 — Publish the three documents as pages

- `/terms/buyers` → Buyer Terms of Use
- `/terms/organisers` → Organiser Terms of Use
- `/refund-policy` → Refund Policy
- `/terms` → a simple landing that routes to the buyer and organiser terms (or redirects to buyers, whichever fits existing routing better — your call, tell me which you did)

If the site already has terms/refund pages at different routes, keep the old routes working with redirects to the new ones. Nothing already linked out in the world may 404.

**Presentation:** these are long documents, so make them readable, styled consistently with the rest of the site — proper typography, rendered tables (the fee tables and refund summary table must render as real tables, not walls of text), a sticky or top table of contents with anchor links per section, and the version number + effective date visible at the top of each page. Mobile is the primary reading device — most buyers will open these from WhatsApp on a phone.

## Goal 2 — Draft a Privacy Policy

The client has not supplied a privacy policy, so draft one at `/privacy`, marked as v1.0 with the same effective date, written in the same plain, direct voice as the three documents. It must be consistent with what the platform actually does and what the terms already say:

- Data collected from buyers at checkout: name, email, phone. Used for ticket delivery and transactional event communications.
- Payments are handled by a third-party payment processor; Ventry does not store card details. (Do not name the processor anywhere buyer-facing.)
- Escrow and refund processing as described in the refund policy.
- Optional marketing: buyers may subscribe to an organiser's future events (Notify Me); this list has unsubscribe, separate from transactional email which cannot be opted out of while holding a valid ticket.
- Organiser data: identity details, bank account for payouts, venue documentation held confidentially and never shown to buyers.
- Buyer data shared with organisers may be used only to run the event purchased for, per the organiser terms and the Nigeria Data Protection Act (NDPA).
- Cookies/analytics: check what the site actually uses and describe only that.
- Contact for data matters: support@ventrybooking.com. Registered entity: Ventry Solutions, RC BN9586934, Abuja, Nigeria.

Frame it under the NDPA as the governing data protection law. Keep it honest and specific to Ventry — no generic boilerplate about practices the platform doesn't have. **This page is a draft for client review** — add nothing that claims practices you can't verify in the codebase.

## Goal 3 — Wire the pages into the product

- Footer on every page links to: Buyer Terms, Organiser Terms, Refund Policy, Privacy.
- Checkout must link to the Buyer Terms and Refund Policy at the point of purchase ("By purchasing you agree to…"), because the buyer terms say purchase constitutes agreement.
- Organiser event-creation flow must link to the Organiser Terms at the point of listing, for the same reason.
- Anywhere the app currently shows inline refund policy text (e.g. on event pages), it should either match the new policy verbatim or link to `/refund-policy` — no stale summaries that contradict the new documents.
- The event page's refund policy section can be a short pointer + link rather than the full text, since tickets were moved above it in the last update.
- Routes `terms` and `privacy` are already in the handle/slug blocklist from the vanity URL work — confirm that's true so no organiser can claim them.

## Done when

- All four pages live, styled, mobile-readable, with working anchor links.
- The three client documents render verbatim — spot-check the fee tables, the refund summary table, and the worked examples against the source files.
- No buyer-facing page names the payment processor.
- Footer, checkout, and event-creation links in place.
- Old terms/refund routes redirect, nothing 404s.
- Privacy page clearly drafted from real platform behaviour, ready for client review.
