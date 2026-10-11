# Ventry 2.0 — public frontend redesign

Major visual upgrade to Ventry's public-facing pages. Three pages: the landing page, the events/browse page, and the event detail page. Admin and organiser dashboards are out of scope and must not be touched.

## Read the design reference first

Three finished HTML mockups are committed at:

- `design-reference/landing.html`
- `design-reference/browse.html`
- `design-reference/event-detail.html`

**Read all three in full before writing any code.** They are the specification, not inspiration. They define the layout, spacing rhythm, type scale, component anatomy, colour usage, copy tone and motion. Where this document and the mockups disagree, the mockups win on anything visual.

They are static mockups with hardcoded sample content. Your job is to rebuild them properly in our Next.js 14 App Router codebase, wired to real data from Supabase, keeping the existing component patterns, theme system and light/dark support.

## Why we're doing this

The current frontend reads as AI-generated: a centred hero over a radial purple gradient with a grid-pattern overlay, a row of pill badges, three feature cards with Lucide icons, four numbered step circles, every section at the same width with the same vertical padding, and type too large throughout so the page feels zoomed in. Remove all of that. The mockups show what replaces it.

The core principle running through the new design: **nothing is presented generically.** Every element on the page should be a specific real thing — a named event with its actual flyer, a named organiser, a real city with a real count, a real price. Where the old pages used an icon to claim something, the new pages show the product doing it.

## Design system

Keep the existing brand. Do not introduce a new palette.

- Dark base, near-black with a violet cast. Purple accent `#7C3AED`, light purple `#A78BFA`.
- Syne for display and headings, DM Sans for body — already in the codebase.
- Headings are pure white. The H1 carries a soft dark text-shadow so it stays legible over textured backgrounds.
- 8pt spacing grid. Card radius 14–18px, pill radius 100px.
- Type scale is deliberately tighter than current: H1 around 50px desktop with a max-width near 9–10 characters per line, section headings 22–30px, body 15px, meta and labels 11–13px. The gap between largest and smallest must be dramatic — nothing sits in the middle.
- Section widths vary on purpose: some full-bleed, some at 1180px, some narrow at ~720px. Vertical rhythm varies too. Identical width and padding on every section is the thing that reads as templated.
- A ticket-perforation dot texture is the brand texture. It appears faintly behind the hero, the settlement section and the purple block. Do not scatter it everywhere.
- Category colours: parties pink, concerts emerald, theatre amber, conferences teal, nightlife purple, online indigo. Define these as tokens, used in both browse chips and card pills.

## Page 1 — Landing (`design-reference/landing.html`)

Sections in order:

1. **Nav** — logo, nav links as pills, Sign in (outline), List your event (filled).
2. **Hero** — split layout, text left, a tilted overlapping stack of three real past-event flyers on the right. Each flyer card carries a caption with the event name, venue and a small badge showing a real outcome ("Sold out", "214 attended"). The cards animate in on page load, staggered. This is the one loud moment on the page.
3. **City strip** — thin full-bleed band of cities with event counts, plus one live platform figure.
4. **On sale now** — horizontal draggable rail of event cards, each showing flyer, verified badge, category pill, date, venue, organiser and price from. Cards snap; the rail runs toward the viewport edge so the next card is cut off, signalling scroll.
5. **Sticky stacked story cards** — four cards that pin and slide over each other as you scroll, each leaving a numbered tab visible at the top so the reader always sees where they are in the sequence. The four: your branded event page, the ticket email landing, the QR scan at the door, the sales dashboard and settlement. Each card is copy on one side, a product mockup on the other. Implement with sticky positioning and incrementing top offsets, exactly as the reference does.
6. **Scroll-scrubbed settlement moment** — a pinned full-height section where the total-settled figure counts up as the user scrolls through it, then three stat cards reveal in sequence. This is the strongest organiser argument we have, so it gets its own screen.
7. **Purple break** — full-bleed block, one bold statement about next-working-day settlement, one white CTA.
8. **Follow an organiser** — circular organiser avatars with names beneath, auto-sliding right to left in an infinite marquee, paused on hover, each linking to that organiser's profile. Compact — this must not take a full screen.
9. **Recently on Ventry** — completed events with attendance and rating.
10. **FAQ accordion** in a narrow column, then footer, then the floating support launcher.

## Page 2 — Browse (`design-reference/browse.html`)

A discovery feed, not a grid of everything.

- **Page header** with a live count and a city picker.
- **Sticky filter bar** under the nav: search input, then a chip row — date chips (Anytime / Tonight / This weekend / This month) which behave as single-select, then category chips and price chips which are multi-select. Chips take their category colour when active. Filters must actually filter.
- **Featured event** — one event laid out wide, image left, details and CTA right.
- **Shelves** — horizontal rails, each answering a different reason to go out.
- **Full grid** for the selected city.
- **Category tiles** with counts.

### Adaptive shelf engine — the important part

We have very few events. A feed with empty shelves looks worse than a short page. Build the shelves as a configured, data-driven system rather than hardcoded sections:

- Every shelf is defined by a query, a heading, a subheading and a **minimum item threshold**. A shelf that doesn't meet its threshold is not rendered at all. Default threshold: 3.
- Shelves are ordered by priority and only the qualifying ones render.
- **Headings adapt to the data.** If nothing falls this weekend, that shelf becomes "Coming up next" over the next 30 days rather than rendering empty or lying. If no events fall under ₦10,000, drop the shelf rather than widening the threshold silently.
- **Past events are inventory too.** A "Recently on Ventry" shelf of completed events, showing attendance and rating, always has something once events complete, and it does real work: it proves events on this platform actually happen. Make sure completed events are reachable and look deliberate, not like leftovers.
- **Thin-inventory fallback.** If total upcoming events across all shelves is below six, collapse the page to: featured event, one "All events" grid, "Recently on Ventry", and category tiles. Fewer sections done properly beats ten padded ones.
- **No duplicate padding.** An event may legitimately appear in two shelves (a cheap Saturday party belongs in both "this weekend" and "under ₦10,000"), but never more than twice on one page, and never twice adjacently.
- **Empty states are invitations.** When a grid or city has nothing, render a short styled note suggesting another city or following an organiser — not a blank area.

### Data honesty rules

Our entire brand is trust. Nothing on these pages may be invented.

- Every count, price, city figure and platform total must come from real data. If a figure isn't available, omit the element rather than showing a placeholder or a rounded guess.
- The mockups contain sample numbers and some invented events purely to show layout. None of them ship.
- Ratings and attendance figures render only where they genuinely exist.
- The organiser marquee needs at least three real organisers to render; duplicate the track enough times for a seamless loop regardless of how many there are.

## Page 3 — Event detail (`design-reference/event-detail.html`)

The conversion page. Keep the fixed banner masthead and per-event organiser accent colour already built in the codebase, and restyle around them.

- The banner is genuinely fixed; the content sheet scrolls up over it with a rounded top edge, so it reads as a sheet lifting off the artwork. Events without a banner degrade gracefully to current behaviour.
- **The organiser's accent colour drives the page**: category pill, selected ticket tier, map pin, buy button, policy card accent, lineup headliner ring. Ventry purple is reserved for platform chrome only — the support launcher and anything that belongs to us rather than to them. Keep the existing contrast-safety logic so a badly chosen colour stays legible in both themes.
- Sections: top bar with back and share over the banner; badges (category, Verified); title; organiser byline with rating; a begins/ends date card; venue card with map, respecting hidden-address events (show city and LGA, never the street, until reveal); the lineup with liability roles rendered distinctly — headliner ringed in the accent, surprise guest hidden behind a pattern with no name; about; organiser card with follow and socials; the organiser's published refund policy as its own accented card.
- **Ticket panel**, sticky on desktop, collapsing to a fixed bottom buy bar on mobile: tiers with remaining counts, sold-out tiers visibly disabled, quantity stepper, and an itemised breakdown — subtotal, service fee, processing fee, total — using the existing fee calculation. The total shown must equal exactly what is debited.
- The NB line stating that Ventry provides the platform while the organiser runs the event and handles refunds appears under the buy button, per the current terms.
- A small trust block: venue checked, QR arrives by email, retrieval link.

## Motion

Restrained and purposeful, not sprinkled everywhere.

- The hero flyer stack animates in once on load, staggered.
- The sticky stack and the settlement scrub are the two orchestrated scroll moments. Build the scrub with a scroll-progress value driving the counter and the staged reveals, using requestAnimationFrame or Framer Motion's scroll utilities — no layout thrash.
- Marquee and rails are the only continuous motion.
- Hover states are subtle lifts, not bouncing.
- `prefers-reduced-motion` must fully disable the stack pinning, the counter animation and the marquee, leaving a readable static page.
- Performance is a constraint, not an afterthought: most of our traffic is cheap Android phones on slow Nigerian data. Images optimised and lazy-loaded below the fold, no heavy animation libraries added if what we have suffices, no scroll handlers without rAF throttling.

## Also fix while you're here

Landing copy still carries escrow-era claims ("Every ticket on Ventry is fully refundable if anything goes wrong", "Escrow Protected", "Automatic Refunds"). That is no longer true and is a liability. Replace all landing and trust copy with what the platform actually does now: verified organisers, QR tickets that can't be copied, next-working-day settlement at 97%, and refund policies published and paid by the organiser.

## Out of scope

Admin dashboard, organiser dashboard, affiliate dashboard, checkout internals, and any backend behaviour. This is a presentation-layer change. If you find a data gap that blocks a section (a field we don't store, a count we can't compute), say so rather than inventing it.

## Done means

On a phone and on a laptop, in both themes:

- The landing page matches the reference in rhythm and density: real flyers in the hero with real outcomes, the sticky stack pinning correctly with visible tabs, the settlement figure counting as you scroll, the organiser marquee sliding and pausing on hover.
- The browse page filters work, shelves render only when they have real content, headings adapt to thin inventory, past events earn a place, and no empty or padded section appears.
- The event detail page shows a genuinely fixed banner with the sheet scrolling over it, the organiser's colour throughout, the lineup roles rendered distinctly, a correct fee breakdown, and a working mobile buy bar.
- No invented numbers anywhere.
- Nothing in the dashboards changed.

Explore the codebase first, flag anything that conflicts with this before building, work page by page with a check-in after each, verify typecheck and production build after each page, and report what shipped, what decisions you made, and anything that needs me (assets, data gaps, migrations).
