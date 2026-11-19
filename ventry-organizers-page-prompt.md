# Build: Ventry "For Organizers" landing page

## What we're building and why

Ventry needs a public marketing page aimed at **event organizers**, the people who list events and sell tickets. Right now the site speaks to buyers. This page is how we convert organizers who are on Eventbrite/Tix.africa/WhatsApp-and-bank-transfer setups into Ventry organizers. Its single job is to get them to click **Become an organizer**.

The angle is "36 reasons to sell your tickets on Ventry": a confident, scannable list of everything they get, led by the money story (free to list, 3% fee, 97% paid out the next working day).

The design is final and signed off. **Build it pixel-faithful, with the copy word-for-word.** Don't rewrite, shorten, "improve" or reorder any copy. If something in the copy is factually wrong about the product, flag it to me. Don't silently fix it.

## Where it lives

- Route: `/organizers` (public, no auth). If an organizer marketing route already exists, tell me before replacing it.
- Next.js 14 App Router, same as the rest of Ventry. A server component is fine. The page is static, with no client JS needed except smooth-scroll for the `#reasons` anchor (CSS `scroll-behavior: smooth` is enough).
- Use our existing layout, header and footer conventions **if** they fit the design below. The design has its own minimal header (wordmark + CTA) and a one-line footer. If the site's global nav/footer would wrap this page, tell me which one you used and why.
- Add proper metadata: title `Become a Ventry organizer: 36 reasons`, description `Free to list. 3% only when you sell. Your money lands the next working day.`, and our default Ventry OG image.
- Link to the page from wherever organizer sign-up is currently promoted (e.g. a "For organizers" link in the main nav/footer). Show me where you put it.

## Before you write UI: audit the 36 claims (important)

Every line on this page is a promise to organizers, and the client's sales docs have already overclaimed features before. **Go through all 36 reasons below and check each one against the actual codebase.** Then give me a table: `# | claim | LIVE / PARTIAL / NOT BUILT | where in the code`.

Ones I'm least sure about: #06 Sponsor link (partners watching sales live), #16 past-event *photos*, #22 scheduled go-live, #23 address reveals, #25 access codes, #27 online events (Zoom/Meet/Teams), #28 promoter tracking links, #35 daily sales email, #09 help bot for organizers (v1 bot was buyer-only), and the "5%" comparison in #03.

**Don't build missing features in this task.** Build the page with the copy exactly as written, report the gaps, and I'll decide with the client whether to re-word or build.

Also confirm:
- The real organizer sign-up route. The design links to `/organizer/register`; use whatever our actual route is.
- Whether `organizers@ventrybooking.com` exists. If not, flag it (don't swap it yourself).

## Visual system

Dark by default. Build the light variant as a second token set too (CSS variables, toggled via the site's existing theme mechanism if there is one; otherwise ship dark only and tell me).

**Fonts** (via `next/font/google`):
- Display/headings/numbers: **Unbounded** 600/700/800
- Body: **DM Sans** 400/500/600/700

**Tokens**

| token | dark | light |
|---|---|---|
| bg | `#0b0814` | `#ffffff` |
| fg | `#f4f0ff` | `#140d24` |
| muted | `#c3b8e0` | `#4f4868` |
| card | `#15102a` | `#f6f2ff` |
| line (borders) | `#2b2147` | `#e2d9f7` |
| acc (buttons, CTA band) | `#7c3aed` | `#6d28d9` |
| accText (accent text) | `#b98cff` | `#6d28d9` |
| soft (pill/step-circle bg) | `#1d1438` | `#ede4ff` |
| green (stats, eyebrows) | `#34e8a4` | `#047857` |

Links: `#b98cff`, hover `#d4b8ff`.

**Layout**: content container `max-width: 1160px`, centred, `24px` side padding. Sections are spaced `clamp(56px, 8vw, 110px)` apart. All grids use `auto-fit/minmax` so it collapses cleanly on mobile, and must look right at 375px wide with no horizontal scroll.

**Shapes**: buttons are full pills (`border-radius: 999px`, min-height 44px). Stat cards have 22px radius, reason cards 24px, the CTA band 32px. Cards are `card` bg with a 1px `line` border. No shadows, no gradients.

**Icons**: inline stroke SVG arrows (right-arrow on "Become an organizer", down-arrow on "See all 36 reasons"), `stroke-width 2.4`, round caps, 18px, `aria-hidden`.

Turn the repeated bits into small components (StatCard, FeatureCard, ReasonGroup, Step, CtaButton), and put the 36 reasons in a typed data array. Don't hand-write 36 `<li>`s.

## Page structure and exact copy

### 1. Header
Flex row, space-between, wraps on mobile, 22px vertical padding.
- Left: wordmark **VENTRY**, Unbounded 800, 24px, letter-spacing 2px, with the **V** in `accText` and the rest in `fg`. Links to home. `aria-label="Ventry home"`.
- Right: pill button `acc` bg, white text, 15px/700, padding 12×22 → **Become an organizer** →

### 2. Hero
Left-aligned column, gap 26px, top padding `clamp(40px,7vw,96px)`.
- Eyebrow pill: `soft` bg, `green` text, 13px/700, letter-spacing 3px → **FOR ORGANIZERS**
- H1 (Unbounded 800, `clamp(38px, 6.4vw, 84px)`, line-height 1.04, letter-spacing -1px, max-width 980px):
  **<span accText>36 reasons</span> to sell your tickets on Ventry.**
- Sub (`muted`, `clamp(18px,2vw,22px)`, max-width 680px):
  **Free to list. 3% only when you sell. Your money lands the next working day.**
- Two buttons (17px, padding 18×30):
  - Primary (`acc`, white): **Become an organizer** →
  - Secondary (1.5px `line` border, `fg` text, 600): **See all 36 reasons** ↓ (anchors to `#reasons`)

### 3. Stats row
`aria-label="Ventry in numbers"`. Grid `minmax(200px,1fr)`, gap 18. Each card: big number in Unbounded 700 `clamp(28px,3.4vw,40px)` in `green`, label below in 15px `muted`.
1. **₦0**: to list your event
2. **~~5%~~ 3%**: platform fee *(the "5%" is smaller (0.6em), struck through, 55% opacity)*
3. **97%**: of every ticket is yours
4. **Next day**: your money settles

### 4. Top six
- H2 (Unbounded 800, `clamp(26px,3.6vw,44px)`): **The ones organizers switch for.**
- Sub (18px muted): **Start with these six. The rest are below.**
- Grid `minmax(300px,1fr)`, gap 18. Each card: number (Unbounded 14px/700 `accText`), H3 (Unbounded 700 `clamp(20px,2vw,24px)`), body (16px muted, lh 1.55).

| # | Title | Body |
|---|---|---|
| 01 | Paid the next working day | Sell on Monday, get paid on Tuesday. 97% of every ticket is yours. |
| 02 | 3% fee, not 5% | Free to list. You only pay when a ticket sells, so you keep 2% more. |
| 03 | Buyers trust you | Every organizer is ID-verified, and the Verified badge shows your venue is confirmed. |
| 04 | A door that can't be faked | Each QR ticket scans once. Your team checks guests in on their own phones. |
| 05 | Your page, your brand | Your banner, your colours and your own link: ventrybooking.com/your-event. |
| 06 | An audience that grows | Notify Me, ratings and your Audience carry into your next event. |

### 5. All 36 reasons (`id="reasons"`)
- H2: **All 36 reasons.**
- Sub: **Everything here is included. Listing is free.**
- Grid `minmax(320px,1fr)`, gap 18, `align-items: start` (cards have different heights; don't stretch them).
- Each group is a card: group label (13px/700 uppercase, letter-spacing 3px, `green`), then a `<ul>` with each `<li>` separated by a 1px `line` top border, 10px vertical padding. Number in Unbounded 13px/700 `accText` in a fixed 30px column, then text 16px where the **bold part** is `<strong>` and the rest is regular weight.

Copy (bold part in `**`):

**Get paid**
- 01 **Paid the next working day**, at 97%
- 02 **Free to list**: no setup fee or subscription
- 03 **3% fee, not 5%**: you keep 2% more
- 04 **Honest checkout**: every fee shown upfront
- 05 **Guest checkout**, no account needed to buy
- 06 **Sponsor link**: partners watch your sales live

**Trust**
- 07 **ID-verified organizers**
- 08 **Verified Event badge** backed by venue proof
- 09 **Real support**: help bot plus the Ventry team

**At the door**
- 10 **QR check-in** on any phone
- 11 **In-app scanner**, no extra app
- 12 **Named staff IDs** for every scan
- 13 **Each QR scans once**, so copies don't get in

**Your brand**
- 14 **Branded event page**: your banner, colours and logo
- 15 **Your own link**: ventrybooking.com/your-event
- 16 **Organizer page** with your past events and photos
- 17 **Share previews** that show your flyer
- 18 **Confirmation emails** in your event's name

**Selling**
- 19 **Ticket tiers and tables**, each with its own capacity
- 20 **Sold-out tiers** close automatically
- 21 **Lineup**: Headliner, Guest Artist, Special and Surprise Guest
- 22 **Scheduled go-live** at the time you pick
- 23 **Address reveals** for secret locations
- 24 **Free ₦0 events** with no platform fee
- 25 **Access codes** for VIP and early-bird tiers
- 26 **Tiers locked to an email domain**, e.g. students only
- 27 **Online events** via Zoom, Meet or Teams
- 28 **Promoter tracking links**
- 29 **QR codes** for your flyers

**Your crowd**
- 30 **Your Audience**: email past buyers for free
- 31 **Notify Me** followers on your page
- 32 **Email reminders** before the event
- 33 **Ratings** after every event
- 34 **Live dashboard** and attendee list
- 35 **Daily sales email**
- 36 **Ticket retrieval** for buyers

### 6. Three steps
- H2: **Start in three steps.** (no sub)
- Grid `minmax(260px,1fr)`, gap 28. Each step: a 48px circle (`soft` bg, `accText` number, Unbounded 700 18px) beside an H3 (19px/700) and body (16px muted).
  1. **Create your account**: Your legal name, the name buyers see, your email and phone.
  2. **Verify your ID**: NIN for individuals, CAC for businesses, before your event goes live.
  3. **List and sell**: Set your tiers, add your flyer and share your link.

### 7. CTA band
Full-container card, `acc` bg, white text, radius 32px, padding `clamp(36px,6vw,72px) clamp(24px,5vw,64px)`, left-aligned column, gap 20.
- H2 (Unbounded 800, `clamp(28px,4.4vw,54px)`, max-width 760): **Ready to sell your next event?**
- Body (19px, `#f1eaff`, max-width 620): **Free to list. 3% only when a ticket sells. Paid the next working day.**
- Button: **white** bg, text `#4c1d95` → **Become an organizer** →
- Small line (15px `#f1eaff`): **Questions?** followed by a mailto link **organizers@ventrybooking.com** (white, bold)

### 8. Footer
40px top padding, 14px `muted`: **Ventry Solutions · ventrybooking.com**

## Quality bar

- Semantic HTML: one `h1`, `h2` per section, `h3` for cards/groups, real `<ul>/<li>`, real `<a>` for all CTAs.
- Text contrast passes WCAG AA in both themes. The tokens above already do; don't swap in lighter greys.
- No layout shift from fonts (`next/font` with `display: swap`).
- Lighthouse: aim for 95+ on performance and accessibility on mobile.
- No new dependencies.

## When you're done, give me

1. The 36-claim audit table (LIVE / PARTIAL / NOT BUILT).
2. Files added/changed.
3. Where you linked the page from.
4. Anything you couldn't match exactly from the spec, and why.
