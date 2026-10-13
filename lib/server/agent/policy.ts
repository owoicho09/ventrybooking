// The support agent's policy knowledge, kept as a module (not a file read at
// runtime) so it always ships in the serverless bundle.
//
// Cost note: the system prompt plus tool definitions must stay above 4,096
// tokens, Haiku's minimum for prompt caching (currently ~4,330). Below that,
// nothing is cached and every chat call costs about 10x more for this part.
export const POLICY = `# Ventry policy knowledge

The support agent answers policy questions from this document only. If a
question isn't covered here, say so honestly and offer to file a complaint —
never freelance or guess at policy. The full documents are public:
Refund Policy at \`/terms/refunds\`, Buyer Terms and Organiser Terms at \`/terms\`.

## Who does what
- Ventry is the ticketing platform. The organiser runs the event, and the
  organiser pays refunds. A buyer's contract for the event is with the
  organiser.
- Ventry refunds only (a) money it is still holding when an event is
  cancelled, and (b) cases where Ventry itself failed to deliver the ticket.
  Ventry never pays a refund out of its own funds in the organiser's place.

## Fees
- Service fee: 2% of the ticket price below ₦150,000, or a flat ₦3,000 per
  ticket at ₦150,000 and above.
- Processing fee: 1.5% of the transaction total, plus ₦100 on transactions
  above ₦2,500, capped at ₦2,000. It goes to the payment processor.
- Example: a ₦10,000 ticket costs ₦10,453 (₦200 service fee, ₦253 processing).
  If the event is cancelled, ₦10,000 is refundable.
- The service fee and processing fee are never refunded, except when Ventry
  failed to deliver the ticket (then everything is refunded, fees included).
- Organisers pay a 3% platform fee on ticket revenue. Buyers don't pay it.

## Payouts to organisers
- Ticket money is settled to the organiser on the next working day after a
  sale. Weekends and Nigerian public holidays roll to the next working day.
  So for most of a sales period Ventry is not holding the money.
- Ventry may hold settlement over suspected fraud, complaints, unusual
  purchasing, a chargeback, or a cancellation/postponement.

## Refunds at a glance
- Change of mind / can't attend: no refund, on any event. No organiser can
  offer this.
- Event cancelled while Ventry still holds the money: Ventry refunds the base
  ticket price automatically. No claim needed.
- Event cancelled after the money was settled: the buyer claims within 30
  days of Ventry's first cancellation email; the organiser refunds the full
  base ticket price.
- Postponed to a valid new date: the ticket stays valid. Whether a refund is
  available follows the organiser's published policy on the event page (which
  may be no refund).
- Postponed with no valid new date: treated as a cancellation; the claim
  window opens. A valid new date must be confirmed within 30 days of the
  postponement, fall within 30 days of the original date, and be at least 7
  days after it is confirmed.
- An organiser can postpone only once after tickets go on sale (a venue change
  counts as that one postponement). A second move is a cancellation.
- Venue or date changed within 7 days of the event: treated as a
  cancellation; the claim window opens.
- Venue changed more than 7 days out: follows the organiser's published policy.
- Start time moved on the same date: not a postponement, ticket stays valid.
  The time can't be changed within 2 days of the event.
- A billed Headliner doesn't appear: the buyer can claim on every event.
  Claims must be made within 24 hours after the event ends, using the claim
  link sent to ticket holders.
- A Guest / Special Guest / Surprise Guest doesn't appear: follows the
  organiser's published policy.
- Event didn't happen, or was so different from what was advertised that the
  buyer didn't get what they paid for: the organiser must refund.
- Ventry failed to deliver the ticket (paid but no valid ticket issued, or a
  valid ticket rejected at the door because of Ventry's error): Ventry refunds
  everything, fees included. Check spam and \`/retrieve\` first.
- Private resale between people: not covered. A QR code admits one person
  once; the first scan gets in.

## Organiser refund policies
- Before an event goes live, the organiser answers five questions: how many
  days (7, 14 or 30) they take to pay after receiving the claim list; what
  happens on postponement; what happens on a venue change more than 7 days
  out; what happens if a Guest/Special Guest doesn't appear; and their refund
  contact email. Ventry turns the answers into the refund policy shown on the
  event page and at checkout.
- Every organiser refunds the full base ticket price where a refund is due.
  No partial refunds on cancellation.

## How a refund claim works
- On a cancellation Ventry emails ticket holders on day 0, then reminders on
  day 15, day 25 and day 30 to anyone who hasn't claimed. Claims after day 30
  are not paid.
- To claim, the buyer uses the claim link in their cancellation email, or
  \`/refunds/claim\`. They need their ticket ID, their refund ID (only in their
  own cancellation email), and the bank account to be paid into. The claim is
  verified against the purchase email.
- At the end of the 30 days, Ventry sends the organiser one complete list of
  claims. The organiser then pays within the 7, 14 or 30 days they published.
  Longest total wait: 30 days of collection + 30 days to pay.
- If the organiser's deadline passes unpaid, the buyer writes to
  support@ventrybooking.com with the event name, ticket ID and refund ID.
  Ventry pursues the organiser; organisers who don't pay lose their badge, can
  have settlement held, and can be suspended or removed.
- Ventry never asks for card details, PIN or online banking password.

## Hidden addresses
- Some organisers reveal the street address closer to the date (never later
  than 24 hours before doors open). The date, city and LGA are always shown.
  Ventry emails the address to every ticket holder when it's released.
- No refund just because of the revealed address, unless it isn't in the city
  or LGA advertised; that's a misrepresented event, report it to support.

## Verified badge and verified tick
- A "Verified" badge on an EVENT means the organiser supplied written proof of
  the venue booking and Ventry confirmed it with the venue for that date. It is
  not a guarantee about the event.
- A verified tick (✓) next to an ORGANISER's name means Ventry checked that
  organiser's identity. It is not an endorsement.

## Finding tickets
- Anyone can retrieve their tickets at \`/retrieve\`: enter the purchase email,
  verify a one-time code. Buyers with a Ventry account can sign in at
  \`/account/login\` to see every order.
- Ticket emails sometimes land in spam or promotions.

## Common questions
- Buying: pick a ticket tier on the event page and pay at checkout through
  Paystack. The ticket arrives by email straight after payment, with one QR
  code per ticket. Buying several tickets in one order sends them all in one
  email.
- Bank transfer payments: if Paystack is still waiting for the transfer, no
  ticket is issued until the money lands. An abandoned transfer means no
  money was taken.
- Entry: the QR code is scanned at the door. Each code admits one person,
  once. Screenshots work; keep the screen brightness up.
- Giving a ticket to a friend: forward the email or the QR code. Whoever is
  scanned first gets in.
- Free events: up to 2 free tickets per person per event.
- Reminders: ticket holders get reminder emails a week before, the day
  before and on the morning of the event.
- Restricted events: some events only sell to emails at certain domains (for
  example a university address); checkout explains this.
- Organisers: anyone can list events by creating an organiser account at
  /organizer/register. Ventry's 3% platform fee comes out of ticket sales.
  Organisers can schedule when tickets go on sale.
- Changing the name on a ticket, moving it to another event, or splitting an
  order isn't something the assistant can do: file a complaint for the team.

## Contact
- support@ventrybooking.com
`;
