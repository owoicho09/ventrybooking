# Ventry Update — Build Plan

You are working on Ventry (ventrybooking.com), a live Nigerian event ticketing platform. Next.js App Router, Supabase Postgres, Paystack payments, Resend email, deployed on Vercel. Real money is moving through this platform right now, with 3 live events. Explore the codebase first and form your own picture of how checkout, event pages, and organiser data currently work before changing anything.

This update has three goals, in strict order. Finish and verify one before starting the next.

---

## Goal 1 — The number on screen must be the number that leaves the buyer's account

**The problem:** A buyer currently sees one total at checkout (e.g. ₦16,830) and gets debited a different amount (₦17,187.83). The gap is the payment processor's fee, which is charged on the final amount but isn't included in the displayed total. This destroys trust at the exact moment we ask for money.

**The new fee model (this replaces whatever fee logic exists now):**

1. **Ticket price** — set by the organiser, untouched.
2. **Ventry service fee** — 2% of the ticket price, capped at ₦3,000, **per ticket**. Four tickets means four separately calculated, separately capped fees. The cap is reached at a ₦150,000 ticket.
3. **Processing fee** — the processor charges 1.5% of the final total, plus ₦100 flat when the total is ₦2,500 or above, capped at ₦2,000 per transaction. Because the fee is charged on the final total, you must gross up — solve for the total, don't add to it:
   - subtotal below ₦2,500 → total = subtotal ÷ 0.985
   - subtotal ₦2,500+ → total = (subtotal + 100) ÷ 0.985
   - if the resulting fee exceeds ₦2,000, total = subtotal + 2,000
   - subtotal = ticket price(s) + service fee(s). Round once, at the total.

Sanity check: subtotal ₦16,830 → (16,830 + 100) ÷ 0.985 = **₦17,187.82**. If your implementation doesn't reproduce this, it's wrong.

**Organiser side:** Ventry's platform fee is now **3% of gross ticket sales**, deducted from the organiser's payout after the event. Organiser dashboards should reflect net amounts under this model. Ventry's cut is never shown to organisers as a line they can see buyers paying — buyers pay their own fees on top; the 3% comes off the payout.

**Checkout must display four lines before the pay button:** ticket price, service fee, processing fee, total. The total shown must equal the amount initialised with Paystack to the kobo — same rounded number passed through, never recalculated on the other side.

**Wording fixes while you're in there:**
- No buyer-facing page, checkout copy, email, or policy text may name "Paystack". Replace every buyer-facing mention with "payment processor". Admin dashboard and internal code can keep the name.
- Wherever an organiser with no completed events is described, show "New organiser" — never "0 events hosted". One completed event shows "1 event hosted", then "N events hosted".

**Done when:** a real low-value test purchase debits exactly the displayed total; four fee lines render at checkout; multi-ticket purchases cap the service fee per ticket; no buyer-facing surface says Paystack.

---

## Goal 2 — Event pages should feel like the organiser's page, with Ventry owning the point of payment

**The problem:** Event pages currently read as Ventry pages that happen to contain an event. Organisers choose platforms partly on how their brand looks to their audience. The rule for everything in this goal: **the organiser owns the top of the page, Ventry owns payment.** Trust elements — Ventry wordmark, escrow badge, Verified badge, footer, everything payment-related — always stay in Ventry's own purple/white styling and are never affected by organiser branding.

**2a. Fixed flyer hero.** The event flyer sits fixed in the top ~25% of the viewport and the page content scrolls over it on an opaque background. Ventry wordmark top-left, always legible — put a soft dark gradient scrim behind it or it disappears on light flyers. Test the fixed positioning on real iOS Safari with the collapsing address bar, not just desktop responsive mode. At flyer upload: enforce an aspect ratio with a crop tool so the organiser chooses the crop, define a safe area so edge text doesn't get cut, and reject images narrower than 1200px with a clear message.

**2b. Organiser accent colour.** Organiser picks one accent colour per event from a preset palette of 8–10 colours — not a free hex picker. The accent drives ticket tier card borders and selected states, the purchase button, checkout progress, and quantity selector active states. Nothing else. Every preset must pass WCAG AA contrast on the purchase button against the dark background. No colour picked → fall back to Ventry purple cleanly.

**2c. Page content order.** Below the hero: verified badge + title, date/time/location summary, share button, description, guest lineup, **then ticket selection**, then location + map, then refund policy, then organiser identity block. Tickets currently sit below the map and a wall of policy text — they move above both. The lineup sits directly above tickets deliberately: it's what converts.

**2d. Venue field and map.** The venue field is free text right now ("Close to Spar"), which can't be geocoded, so the map renders the whole world. Replace it with a Google Places Autocomplete picker; store place_id, formatted address, and coordinates; keep an optional free-text note alongside for landmarks. If a place can't be resolved, render **no map at all** — no map beats a map of the Atlantic. Zoom around level 15.

**2e. Vanity URLs.** Events move from UUID URLs to slugs: ventrybooking.com/wildout-2-0. Slug generated from the title, editable at creation, unique across the namespace, append -2/-3 on collision. Organisers get a handle: ventrybooking.com/@handle. Handle and display name are separate fields — someone must be able to change how their name reads without breaking a link already shared on WhatsApp. Handles are first-come, permanent once an event is live under one. Blocklist: admin, support, events, retrieve, login, api, blog, terms, privacy, help, ventry, plus every existing route. **Old UUID URLs must 301 to the new slugs — links already out in the world cannot break.**

**2f. Share cards.** Auto-generate a 1200×630 OG image per event: flyer as background, organiser logo, event name, date, small Ventry mark. Generated on publish, regenerated on any flyer or title edit, CDN-cached with cache busting on regeneration. Set og:title, og:description, og:url, and twitter:card as summary_large_image. WhatsApp previews are the biggest referral channel — a pasted link should look like the organiser posted it, not like a generic Ventry preview.

**Done when:** a live event page shows the fixed hero with legible wordmark on both dark and white flyers, accent colour applied only to the elements listed, tickets above the map, a working map or no map, slug URL live with the old UUID URL redirecting, and a link pasted into WhatsApp showing the branded card.

---

## Goal 3 — Organiser profile / storefront

**The problem:** Organisers run multiple events, but there's nowhere a buyer can see who an organiser is and everything they've run. We want a branded home for each organiser that builds trust and captures future demand.

**The page lives at ventrybooking.com/@handle** and contains:
- Header: avatar/logo, display name, verification status, member since, events hosted count (using the "New organiser" rule from Goal 1), short bio, social links.
- **Upcoming events**, newest first — full cards, primary focus.
- **Past events**, clearly marked as completed — visually secondary, but present. This is the organiser's track record and it's what makes a first-time buyer trust them.
- A **Notify Me** button: captures email (phone optional), stored against the organiser — not any single event — and fires when that organiser publishes their next event. This is a marketing list, legally distinct from transactional email, so it must have a working unsubscribe link.

**The organiser identity block on every event page** (avatar, name, badge, member since, event count, bio, socials) links through to this storefront.

**Email sender identity, so the storefront relationship carries into the inbox:** ticket confirmations, reminders, and change notices send with the **event name** as the sender name; refund confirmations send as **Ventry**; next-event teasers to Notify Me subscribers send as the **organiser display name**. All reply-to addresses are support@ventrybooking.com — organisers never receive refund mail directly. Sending domain stays Ventry's own; never send from organiser domains.

**Done when:** an organiser's @handle page shows their upcoming and completed events with their branding, Notify Me subscribes and unsubscribes correctly, and a subscriber gets a teaser sent under the organiser's name when a new event goes live.

---

## Ground rules

- Escrow, payout release, QR validation, and refund mechanics are live and working. Do not restructure them. Goal 1 changes fee *calculation and display*, not the escrow model.
- Nothing here removes any existing feature. Reorder, rebrand, and fix — don't drop.
- Money code gets verified with a real low-value transaction before it's called done. Kobo-level equality between displayed and debited is the bar.
- If anything in the codebase contradicts this plan in a way that matters (e.g. fee logic lives somewhere unexpected, tickets and orders are modelled differently than implied), stop and flag it rather than guessing.
