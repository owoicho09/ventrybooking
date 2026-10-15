// Ventry help centre for the support assistant: how-to guides for buyers,
// organisers and affiliates. Fetched on demand through the get_help_article
// tool rather than sent with every message, so a big knowledge base doesn't
// raise the cost of every chat call. Refund/fee policy itself lives in
// policy.ts (always in the prompt).
//
// Keep every line true to the product. When a feature changes, change it
// here too, or the assistant will confidently describe the old behaviour.

export const HELP_TOPICS = {
  about_ventry: 'What Ventry is, who it is for, contact details, where to find things on the site',
  buying_tickets: 'How buying works: checkout, email code, payment methods, fees, what you receive, free tickets, restricted events',
  tickets_and_entry: 'Finding tickets, resending, buyer accounts, entry and QR codes, passing a ticket to someone, reminders, reviews',
  organiser_getting_started: 'Becoming an organiser and listing a first event, step by step, including making it live or scheduling go-live',
  organiser_event_page: 'Everything on the create-event form: tiers, flyer and banners, accent colour, lineup roles, hidden address, venue proof and the Verified badge, refund questions, preview',
  organiser_managing_events: 'Editing a live event, ticket tiers, changing the go-live time, date/venue/time change rules, cancelling, event QR code, attendee list',
  organiser_verification: 'Identity verification with NIN or CAC, the ₦500,000 limit for unverified organisers, the verified tick, display name vs legal name',
  organiser_payouts: 'How and when organisers get paid, bank account setup and changes, Withdraw now, fees deducted, daily sales email, held payouts',
  organiser_door_scanning: 'Checking tickets at the door: Ventry scanner, phone camera, Staff IDs for door staff',
  organiser_marketing: 'Selling more: sharing the link, organiser profile page, Audience and Notify Me, event affiliate tracking links, reviews',
  organiser_refund_claims: 'What organisers do when refund claims come in: claim list, deadlines, reporting payment',
  affiliate_programme: 'The Ventry affiliate programme for people who refer organisers: how it works, commission, payment',
} as const;

export type HelpTopic = keyof typeof HELP_TOPICS;

export const HELP_ARTICLES: Record<HelpTopic, string> = {
  about_ventry: `
Ventry (ventrybooking.com) is a Nigerian event ticketing platform. Organisers list events and sell tickets; buyers discover events, pay, and get QR tickets by email. Ventry Solutions is registered in Nigeria (BN9586934), based in Abuja.
- Browse events: ventrybooking.com/events (filter by city, category, online events).
- Help page: /help. Terms: /terms (Buyer Terms, Organiser Terms, Refund Policy, Affiliate Policy). Privacy: /privacy.
- Organisers sign up at /organizer/register and log in at /organizer/login. Buyers can sign in at /account/login. Affiliates: /affiliates.
- Support email: support@ventrybooking.com. The team replies by email.
- Buyers must be 18 or older to buy on Ventry; some events set a higher age limit.
- Ventry is the ticketing platform, not the event organiser (unless an event page says Ventry is organising). The organiser runs the event.

Why use Ventry instead of selling by WhatsApp and bank transfer:
- Buyers pay through Paystack and get a real ticket with a unique QR code by email instantly; no screenshots of transfers to check by hand.
- One QR code admits one person once, so the same ticket can't be used twice at the door. Door staff scan with a phone (Ventry scanner or Staff ID links).
- Organisers get an event page to share, ticket tiers, an attendee list, daily sales emails, and their money the next working day.
- Buyers see the organiser's refund policy before paying, and there is a set claims process if an event is cancelled. Ventry verifies organiser identity (verified tick) and venue bookings (Verified event badge), which helps buyers trust a new organiser.
- Lost tickets can be recovered any time at /retrieve.
- Organisers stay responsible for their event, refunds they owe and any chargebacks; Ventry provides the platform and collects payment for them.
- Cost: listing is free; organisers pay 3% on paid tickets; buyers pay a small service and processing fee shown at checkout.`,

  buying_tickets: `
- On the event page, choose a ticket tier and quantity, then check out.
- At checkout you enter your name and email. If you're not signed in, Ventry emails a 6-digit code to confirm the address (so tickets can't go to a mistyped email). Signed-in buyers skip this.
- Payment goes through Paystack: card, bank transfer and the other options Paystack shows at checkout. Every fee is itemised before you pay.
- Fees: Ventry service fee 2% of the ticket price (flat ₦3,000 per ticket at ₦150,000 and above) plus a payment processing fee (1.5% + ₦100 above ₦2,500, capped at ₦2,000).
- After payment you get one email with a QR code per ticket. You can also see tickets at /retrieve or in your account.
- Paid by bank transfer? The ticket is issued once Paystack receives the transfer. An abandoned or failed attempt means no money was taken.
- Free events: up to 2 free tickets per person per event; no payment needed, the email code still applies.
- Some events are restricted to certain email domains (e.g. a university address); checkout tells you if your email isn't allowed.
- During checkout there's an optional box to hear about future events from that organiser and from Ventry.`,

  tickets_and_entry: `
- Can't find your ticket: check spam/promotions, then go to /retrieve, enter the purchase email and the one-time code; tickets show there. The assistant can also resend the ticket email to the purchase address.
- Buyer account: sign in at /account/login with your email to see every order.
- Entry: the QR code is scanned at the door. One QR code admits one person, once. Screenshots work; turn screen brightness up. If a code won't scan, door staff can check the ticket ID.
- Bought several tickets? Each person needs their own QR code; they are all in the one email.
- Giving a ticket to a friend: forward the email or the QR code. Whoever is scanned first gets in. Private resale is at your own risk; Ventry only stands behind tickets bought on ventrybooking.com.
- Reminders: emails a week before, the day before, and the morning of the event.
- Hidden addresses: some events reveal the street address later (at least 24 hours before doors); Ventry emails it to every ticket holder.
- After the event, attendees get an email asking for a review of the event.`,

  organiser_getting_started: `
Steps to sell tickets on Ventry:
1. Sign up at /organizer/register (your name, a display name buyers will see, email). Confirm your email; you must do this before you can create events.
2. Go to Create Event in your dashboard (/organizer/events/create) and fill in the form: details, date & location, lineup (optional), ticket tiers, refund policy (five questions), then Review & Publish.
3. Choose when tickets go on sale: "Go live now" puts the event on sale the moment you publish (no waiting for Ventry approval; the team reviews after and may contact you). "Schedule" lets you pick a date and time; the event stays hidden until then, goes on sale automatically, and Ventry emails you when it's live. You can move the time as often as you like before then.
4. Share your event link (ventrybooking.com/your-event-name) and your event QR code.
5. Add your payout bank account and verify your identity on the Payouts page so you get paid (see payouts and verification).
- Listing is free, and free events cost nothing. On paid tickets Ventry keeps 3% at payout; buyers pay the service and processing fees on top of your price.
- If your event doesn't appear: check it isn't scheduled for later, and that you confirmed your email.`,

  organiser_event_page: `
The create-event form (/organizer/events/create):
- Details: name, category, description, flyer (portrait image, used on cards), optional wide header banner, accent colour (your event page is themed in it; it can be detected from your flyer), optional email-domain restriction for closed events.
- Date & location: date, start time, physical or online (online needs a meeting link, shared only with ticket holders). Physical events need venue, full address, city and LGA.
- Hide the street address until a reveal time you choose (no later than 24 hours before doors). Date, city and LGA always show.
- Venue proof: upload a booking confirmation, venue agreement, invoice or receipt naming the venue and date (a photo of the building is not accepted). Add a venue contact; Ventry calls them to confirm the booking. Proof + a confirmed call gives your event the "Verified" badge. You can list without it; the event just won't carry the badge. Proof can also be added after creating the event.
- Lineup: each act is Headliner, Guest Artist/Special Guest, or Surprise Guest (name hidden from buyers). Only one Headliner. Billing a Headliner means buyers can claim a refund if that act doesn't appear; guests don't carry that.
- Ticket tiers: name, price and quantity for each (e.g. Regular, VIP, Table). Price 0 makes it free.
- Refund policy: five questions (days to pay refunds after a cancellation: 7, 14 or 30; what happens on postponement; venue change more than 7 days out; a guest not appearing; your refund contact email). Ventry writes the published policy from your answers and shows it on the event page and at checkout.
- Preview: see your event page in light and dark mode before publishing.
- Confirm the information is accurate, choose go live now or schedule, and publish.`,

  organiser_managing_events: `
Open the event from My Events (/organizer/events) to manage it.
- Before any ticket is sold you can edit everything freely, including name, date, venue and time.
- After the first sale: name and category lock. Changing the date or venue counts as a postponement (allowed once; never within 7 days of the event; the new date must be within 30 days of the original and at least 7 days away). A same-day start-time change is allowed except within 2 days of the event. Buyers are emailed about changes automatically.
- The refund policy can be changed until a ticket is sold, then it locks.
- Ticket tiers: add new tiers any time, and edit a tier's price or quantity (quantity can't go below what's already sold). Raising quantity is how you add more tickets to a sold-out tier.
- Go-live time: on the event page, "When tickets go on sale" lets you move the scheduled time or go live now. A live event with no sales can still be scheduled; once tickets sell it can't be taken off sale.
- Event QR code: a branded QR for your event link to put on flyers and posters.
- Attendee list: download a CSV of buyers (name, tier, quantity, date, marketing consent).
- Cancelling or anything else not editable: contact support@ventrybooking.com. On a cancellation, buyers are refunded under the Refund Policy (see refund claims).`,

  organiser_verification: `
- Where: the verification panel on the Payouts page (/organizer/payouts).
- Individuals verify with their NIN; registered businesses with their CAC number. Checked by Dojah, a licensed verification provider; takes about two minutes. Ventry keeps only the name and the last 4 digits, never the full NIN or photo.
- The NIN must be in your legal name. Display name (what buyers see, can be a brand) and legal name (verified, must match your bank account) are separate; the legal name is set under the bank account section.
- Without verification you can sell and be paid up to ₦500,000 in total (across all events, ever). After that, payouts pause until you verify; tickets keep selling and paused money is released once verified.
- Verified organisers get a verified tick (✓) next to their name and no payout cap. The tick confirms identity; it is not an endorsement.
- The event "Verified" badge is different: it comes from venue proof plus Ventry confirming the booking with the venue.`,

  organiser_payouts: `
- Each day's ticket sales are paid to your bank account on the next working day (weekends and Nigerian public holidays roll to the next working day), minus Ventry's 3% platform fee. You receive 97% of the ticket price; buyer fees don't come out of your money.
- Set up: Payouts page (/organizer/payouts) → add your bank account in your own legal name (or your business's registered name). Ventry confirms the account name with your bank. Payouts only go to an account matching your verified name.
- Changing the bank account needs your password and a code emailed to you.
- Choose how you're paid on the Payouts page ("How do you want to be paid?"): "Straight to my bank" (default: each day's sales paid automatically the next working day) or "Keep in my Ventry wallet" (sales build up in your wallet; tap Withdraw whenever you like and Ventry pays the whole available balance to your bank, usually the same working day). You can switch any time; switching back to bank pays the balance in the next working-day payout.
- Withdraw now (bank option): asks Ventry to pay what's available today instead of waiting for the next run.
- The Payouts page shows settled, pending and per-event figures, and your payout history.
- Daily sales email: on any day you sell tickets, you get an email the next morning with the count per event. No sales, no email.
- Payouts can pause if: no bank account, the account name doesn't match, you passed ₦500,000 unverified, or Ventry has a hold (e.g. suspected fraud, chargebacks, a cancellation/postponement, or headliner no-show claims being checked).
- Platform fee example: ₦10,000 ticket → you get ₦9,700; the buyer pays ₦10,453.`,

  organiser_door_scanning: `
Three ways to check tickets at the door:
- Ventry scanner (default): open Scanner in your organiser dashboard (/organizer/scan, also on the mobile bottom bar) and scan QR codes with the in-app camera.
- Phone camera: switch the Scanner page to the phone-camera option; scanning a ticket QR with the normal camera opens its check-in page.
- Staff IDs (/organizer/staff): create a short access code for door staff, copy the scan link and send it (e.g. WhatsApp). Staff open it in their browser before doors and keep the tab open. No account needed, they only see scan results (full-screen green/red), every scan is logged with their code, and the IDs expire 24 hours after the event.
- Each QR admits once; a second scan shows it was already used.`,

  organiser_marketing: `
- Share your event link and the event QR code (on the event's page in your dashboard).
- Organiser profile page: set a handle in Settings to get ventrybooking.com/yourhandle, listing your upcoming and past events with your bio and cover image. Visitors can tap Notify Me to hear about your next events.
- Audience (/organizer/audience): people who ticked your mailing box at checkout or tapped Notify Me. You see names only; you compose an email and Ventry reviews and sends it for you (nothing goes out automatically).
- Event affiliates (/organizer/affiliates): give promoters their own tracking links per event and see clicks and completed purchases per promoter (never buyer details). Only for live events.
- Reviews: after your event, attendees are asked for a review; ratings show on your event.
- Verified tick and Verified event badge help buyers trust a new organiser.`,

  organiser_refund_claims: `
- When an event is cancelled (or changed where your policy offers refunds), buyers claim through Ventry for 30 days. Buyers are emailed on day 0, 15, 25 and 30.
- At the end, you receive one list of everyone who claimed with each buyer's bank details. You pay each buyer directly within the days you published (7, 14 or 30), counted from when the list is sent.
- Money Ventry still holds for the event is refunded to those buyers automatically; they're marked on the list so nobody is paid twice.
- After paying, report it on the Refunds page (/organizer/refunds) with proof (a bank statement or transfer receipts covering everyone). Ventry tells each buyer.
- Not paying valid claims gets recorded against your account and can lead to losing the badge, held payouts, suspension or removal.
- Ventry's 3% platform fee isn't returned on cancelled or refunded sales.`,

  affiliate_programme: `
- Anyone can join at /affiliates (sign up at /affiliate/register, no fee, no approval wait).
- You get a referral link. Send it to event organisers who aren't on Ventry yet. Clicking it credits you for 30 days (first click wins); if they register as an organiser in that time, they're yours permanently.
- Commission: 30% of Ventry's 3% platform fee, which is 0.9% of ticket sales, on the first three events each referred organiser runs. From their fourth event onward you earn nothing on that organiser. No limit on how many organisers you refer.
- Events must actually take place to earn; cancelled events don't count and free a slot.
- Commission builds up as they sell; Ventry pays it to a bank account in your own name. Your dashboard (/affiliate/dashboard) shows pending and paid totals.
- Full rules: /terms/affiliates.
- Different thing: organisers can also give promoters per-event tracking links from their own dashboard; that's arranged with the organiser, not this programme.`,
};

export function helpTopicList(): string {
  return Object.entries(HELP_TOPICS).map(([k, v]) => `- ${k}: ${v}`).join('\n');
}
