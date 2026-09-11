import Link from 'next/link';
import { LegalLayout, Section, Sub, P, Ul, Table } from '@/components/legal/LegalDoc';
import { LEGAL_VERSIONS } from '@/lib/legalVersions';

const VERSION   = LEGAL_VERSIONS.refundPolicy.version;
const EFFECTIVE = LEGAL_VERSIONS.refundPolicy.effective;
const EMAIL     = 'support@ventrybooking.com';

const toc = [
  { id: 'short-version',        label: '1. The short version, at a glance' },
  { id: 'who-pays',              label: '2. Who pays refunds' },
  { id: 'what-ventry-does',      label: '3. What Ventry does when an event goes wrong' },
  { id: 'refundable',            label: '4. What is refundable and what is not' },
  { id: 'organiser-policies',    label: '5. Refund policies set by organisers' },
  { id: 'claim-window',          label: '6. Cancelled events, the claim window and the claim list' },
  { id: 'how-to-claim',          label: '7. How to claim a refund' },
  { id: 'postponed-events',      label: '8. Postponed events, venue changes and time changes' },
  { id: 'headliners',            label: '9. Billed headliners who do not appear' },
  { id: 'address-reveal',        label: '10. Events where the address is revealed later' },
  { id: 'reselling',             label: '11. Reselling a ticket' },
  { id: 'ventry-direct-refunds', label: '12. When Ventry refunds you directly' },
  { id: 'fraud-reporting',       label: '13. Fraud, reporting, and funds we still hold' },
  { id: 'chargebacks',           label: '14. Chargebacks' },
  { id: 'changes-contact',       label: '15. Changes to this policy, and contact' },
];

export default function RefundPolicyPage() {
  return (
    <LegalLayout
      title="Refund Policy"
      version={VERSION}
      effective={EFFECTIVE}
      toc={toc}
      intro={
        <>
          In short: Ventry provides the ticketing platform. The organiser runs the event and the organiser pays refunds.
          Ventry refunds only where it is still holding the money, or where Ventry itself failed to deliver your ticket.
        </>
      }
    >
      <Section id="short-version" title="1. The short version, at a glance">
        <Table
          head={['Situation', 'What happens']}
          rows={[
            ['Event cancelled, Ventry still holds the money', 'Ventry refunds your base ticket price automatically. No claim needed.'],
            ['Event cancelled, money already settled', 'Claim within 30 days of our notice. The organiser refunds your full ticket price.'],
            ['Event postponed, new date given', 'Your ticket stays valid. Refunds follow what the organiser published, which may be none.'],
            ['Event postponed, no valid new date', 'It becomes a cancellation and the claim window opens.'],
            ['Venue or date changed within 7 days of the event', 'Treated as a cancellation. The claim window opens.'],
            ['Time changed on the same day', 'Not a cancellation. Your ticket stays valid.'],
            ['A billed Headliner does not appear', 'You can claim. This protection applies on every event.'],
            ['A Guest or Special Guest does not appear', 'Follows what the organiser published.'],
            ['You change your mind or cannot attend', 'No refund. No event on Ventry offers this.'],
            ['You resold your ticket privately', 'Not our concern and not our responsibility.'],
            ['Ventry failed to deliver your ticket', 'Ventry refunds everything you paid, fees included.'],
            ['Service fee and processing fee', 'Never refunded, except in the row above.'],
          ]}
        />
      </Section>

      <Section id="who-pays" title="2. Who pays refunds">
        <Sub title="2.1 The organiser, in most cases">
          <P>
            When you buy a ticket on Ventry, your contract for the event is with the organiser, not with Ventry. Ventry
            settles ticket money to organisers on the next working day after a sale, so by the time most events happen
            the organiser holds the money and the organiser pays any refund.
          </P>
        </Sub>
        <Sub title="2.2 Ventry, where Ventry still holds the money">
          <P>
            If an event is cancelled while Ventry is still holding funds for it, Ventry refunds the base ticket price on
            those tickets directly and automatically. You do not need to claim and you do not need to contact anyone.
            This applies only to money Ventry still holds at the time of the cancellation.
          </P>
        </Sub>
        <Sub title="2.3 Ventry does not fund refunds">
          <P>
            Beyond section 2.2 and section 12, Ventry does not issue refunds, does not fund them, and is not liable for
            a refund an organiser fails to pay.
          </P>
        </Sub>
        <Sub title="2.4 Why the policy is written this way">
          <P>
            We would rather say this plainly at the point of purchase than leave you to discover it after something has
            gone wrong. What Ventry can do when an organiser fails is set out in sections 3, 7 and 13, and we do it.
            What we cannot do is pay you in the organiser&apos;s place.
          </P>
        </Sub>
      </Section>

      <Section id="what-ventry-does" title="3. What Ventry does when an event goes wrong">
        <P>Ventry:</P>
        <Ul items={[
          'verifies organisers before they can sell, and requires documented proof of the venue booking;',
          'notifies you by email when an organiser tells us an event has been cancelled, postponed or changed;',
          'refunds the base ticket price automatically on any funds we are still holding;',
          'opens a 30-day claim window on a cancellation and emails you four times during it;',
          'sends the organiser one complete list of everyone who claimed, so nobody is paid ahead of anybody else;',
          'requires every organiser to publish a refund position on the event page before you pay;',
          'requires refund protection on any act billed as Headliner;',
          'records failures to refund, and suspends or permanently removes organisers who do not pay what they owe;',
          'investigates reports of fraud and cooperates with law enforcement and other authorities.',
        ]} />
        <P>Ventry does not pay refunds out of its own funds and cannot compel an organiser to pay one.</P>
      </Section>

      <Section id="refundable" title="4. What is refundable and what is not">
        <Sub title="4.1 The three amounts you paid">
          <Table
            head={['Amount', 'Refundable?']}
            rows={[
              ['Base ticket price', 'Yes, where a refund is due.'],
              ['Ventry service fee', 'No, except under section 12.2.'],
              ['Payment processing fee', 'No, except under section 12.2.'],
            ]}
          />
        </Sub>
        <Sub title="4.2 What you pay at checkout">
          <P>
            The service fee is 2% of the ticket price below NGN 150,000, or a flat NGN 3,000 at NGN 150,000 and above.
            The processing fee is 1.5% of the transaction total, plus NGN 100 on transactions above NGN 2,500, capped at
            NGN 2,000 and rounded up to the next naira. Every line is itemised before you pay, and the total shown is
            exactly what leaves your account.
          </P>
          <Table
            head={['On a NGN 10,000 ticket', 'Amount']}
            rows={[
              ['Base ticket price', 'NGN 10,000'],
              ['Service fee, 2%', 'NGN 200'],
              ['Processing fee, 1.5% of NGN 10,200 plus NGN 100', 'NGN 253'],
              ['Total you pay', 'NGN 10,453'],
              ['Refundable if the event is cancelled', 'NGN 10,000'],
            ]}
          />
        </Sub>
        <Sub title="4.3 Why the service fee is not refundable">
          <P>
            The service fee pays for what Ventry does for you at the point of purchase: issuing your ticket, delivering
            it, sending your confirmation and reminders, running the QR and check-in system, and providing ticket
            retrieval and support. That work is done when your ticket is issued, whether or not the organiser later
            holds the event.
          </P>
        </Sub>
        <Sub title="4.4 Why the processing fee is not refundable">
          <P>
            The processing fee is paid to our payment processor at the moment of payment. It is not retained by Ventry
            and it is not returned to Ventry when a payment is reversed. Refunding it would mean paying it twice.
          </P>
        </Sub>
        <Sub title="4.5 What the organiser keeps">
          <P>
            Ventry&apos;s 3% platform fee is not returned to the organiser when an event is cancelled. The organiser is
            nonetheless required to refund your full base ticket price.
          </P>
        </Sub>
      </Section>

      <Section id="organiser-policies" title="5. Refund policies set by organisers">
        <Sub title="5.1 No event on Ventry refunds a change of mind">
          <P>
            This is worth saying first. No organiser on Ventry offers a refund because you decided not to attend, could
            not make it, or changed your mind. That is not an option any organiser can select. Buy a ticket only if you
            intend to use it.
          </P>
        </Sub>
        <Sub title="5.2 What organisers do choose">
          <P>
            Refund policies on Ventry deal with what happens when the organiser is the one who changes something. Before
            an event can go live the organiser answers five questions, and Ventry generates the published refund policy
            from their answers. It appears on the event page and again at checkout, so you see it before you pay.
          </P>
          <Table
            head={['The organiser is asked', 'Their options']}
            rows={[
              ['If you cancel, how long after receiving the claim list will you refund?', '7, 14 or 30 days'],
              ['If you postpone to a confirmed new date, what happens?', 'All buyers refunded, or ticket stays valid with refund on request, or ticket stays valid with no refund'],
              ['If you change the venue more than 7 days out, what happens?', 'Refund on request, or no refund and the ticket stays valid'],
              ['If a Guest or Special Guest does not appear, what happens?', 'Refund on request, or no refund'],
              ['Which email address should buyers use for refund questions?', 'Their own working address'],
            ]}
          />
        </Sub>
        <Sub title="5.3 The amount is not something they choose">
          <P>
            Every organiser refunds the full base ticket price where a refund is due. Ventry does not permit partial
            refunds on cancellation and no organiser can offer you less. What they choose is how long they take to pay
            it, and that is published before you buy.
          </P>
        </Sub>
        <Sub title="5.4 Postponement may carry no refund">
          <P>
            An organiser may publish that a postponement carries no refund, provided a valid new date is confirmed under
            section 8.4. We allow this because a postponed event that goes ahead is still the event you bought a ticket
            for. Their position is on the event page before you pay, and our postponement email points you to it.
          </P>
        </Sub>
        <Sub title="5.5 The minimum standards that always apply">
          <P>Whatever an organiser has published, Ventry requires that:</P>
          <Ul items={[
            'if the event is cancelled, the organiser refunds the full base ticket price to every buyer who claims within the window;',
            'if the event is postponed and no valid new date is confirmed, it is treated as a cancellation and the claim window opens;',
            'if the venue or date changes within 7 days of the event, it is treated as a cancellation;',
            'if an act billed as Headliner does not appear, buyers may claim;',
            'if the event does not take place, or takes place in a form so different from what was advertised that you did not receive what you paid for, the organiser refunds you;',
            'the organiser provides a working email address for refund questions and responds within five working days.',
          ]} />
          <P>Where an organiser&apos;s published policy is narrower than these standards, these standards apply.</P>
        </Sub>
      </Section>

      <Section id="claim-window" title="6. Cancelled events, the claim window and the claim list">
        <P>
          You have 30 days from our first notice to claim. We collect every claim across those 30 days and send the
          organiser one complete list at the end. Their deadline to pay starts from the date we send that list.
        </P>
        <Sub title="6.1 Why you have to claim">
          <P>
            Organisers do not hold your contact details. Ventry does, which is what keeps your data protected, and it
            means an organiser cannot refund you without you coming forward. So a refund on a cancelled event starts
            with a claim from you.
          </P>
        </Sub>
        <Sub title="6.2 The window">
          <P>
            30 days, running from the date Ventry sends the first cancellation notice. Not from the date the organiser
            decided to cancel, and not from the original event date. From our email.
          </P>
        </Sub>
        <Sub title="6.3 The four emails">
          <Table
            head={['When', 'What we send']}
            rows={[
              ['Day 0', 'The event is cancelled, how to claim, and that you have 30 days'],
              ['Day 15', 'Reminder, 15 days left, to everyone who has not claimed'],
              ['Day 25', 'Reminder, 5 days left, to everyone who has not claimed'],
              ['Day 30', 'Final notice on the last day, to everyone who has not claimed'],
            ]}
          />
          <P>Every one of those emails contains your claim link and the details you need. If you have claimed, the reminders stop.</P>
        </Sub>
        <Sub title="6.4 After the window closes">
          <P>
            A claim made after day 30 is not paid. We are stating that plainly rather than leaving it vague, and we
            email you four times across the thirty days so the deadline is not something you can reasonably miss. The
            window has to end somewhere for an organiser to be able to settle and close their books.
          </P>
        </Sub>
        <Sub title="6.5 The claim list">
          <P>
            At the end of the 30 days Ventry sends the organiser one list of everyone who claimed, with the bank details
            each buyer supplied, and confirms to buyers that it has gone out.
          </P>
          <P>
            We do it as a single list rather than passing claims through as they arrive, for three reasons. It shows the
            organiser their whole liability at once, instead of letting them pay whoever claimed first and run out of
            money. It means every buyer on the list is treated the same way. And it lets us mark anyone Ventry has
            already refunded from held funds, so nobody is paid twice and nobody is missed.
          </P>
        </Sub>
        <Sub title="6.6 When the organiser must pay">
          <P>
            Within the timeframe they published, being 7, 14 or 30 days, counted from the date Ventry sends them the
            claim list. So the longest total wait is 30 days of collection followed by 30 days to pay.
          </P>
        </Sub>
        <Sub title="6.7 Confirmation">
          <P>
            When the organiser has settled the list they report it to Ventry with proof of payment, and we notify you.
            If your deadline passes without payment, see section 7.5.
          </P>
        </Sub>
      </Section>

      <Section id="how-to-claim" title="7. How to claim a refund">
        <Sub title="7.1 What you need">
          <P>Two things, both in your cancellation email:</P>
          <Ul items={[
            'your ticket ID;',
            'your refund ID, which is unique to your ticket and appears only in your own cancellation email.',
          ]} />
        </Sub>
        <Sub title="7.2 It must come from the email address you bought with">
          <P>
            Your claim must be submitted from, or verified against, the email address used to buy the ticket. This is
            what stops someone who has been forwarded your cancellation email from claiming your refund into their own
            account.
          </P>
        </Sub>
        <Sub title="7.3 What you submit">
          <P>Your ticket ID, your refund ID, and the bank account the refund should be paid to. Use the claim link in your cancellation email.</P>
        </Sub>
        <Sub title="7.4 What happens next">
          <P>
            Your claim is recorded with the date and time it was received and goes onto the claim list for that event.
            The organiser pays you directly. Ventry does not hold or pass on the money.
          </P>
        </Sub>
        <Sub title="7.5 If the organiser does not pay">
          <P>
            If their published deadline passes and you have not been paid, write to{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a> with the event name,
            your ticket ID and your refund ID. We will take it up with the organiser and require proof of payment from
            them. Where an organiser cannot show they paid a valid claim, the failure is recorded against their account.
          </P>
          <P>
            Organisers who do not pay valid claims lose their verification badge, can have settlement held on their
            other events, and can be suspended or permanently removed from Ventry. We cannot force an organiser to pay
            you and we will not pay you in their place. What we can do is make it costly for them not to, and we do.
          </P>
        </Sub>
        <Sub title="7.6 Do not send your details to anyone else">
          <P>
            Claim through Ventry. Ventry will never ask for your card details, your PIN, or your online banking
            password, and no legitimate refund process requires any of them.
          </P>
        </Sub>
      </Section>

      <Section id="postponed-events" title="8. Postponed events, venue changes and time changes">
        <Sub title="8.1 An event can only be postponed once">
          <P>
            An organiser may postpone an event once after tickets have gone on sale. A change of venue counts as that
            one postponement. If they need to move it again, it is treated as a cancellation, the event closes, and the
            claim window opens.
          </P>
        </Sub>
        <Sub title="8.2 Nothing can move within 7 days of the event">
          <P>
            A postponement or a change of venue inside 7 days of the event date is treated as a cancellation. By that
            point people have arranged their day, made travel plans and in some cases paid for other things, so a late
            move is not something we treat as a reschedule.
          </P>
        </Sub>
        <Sub title="8.3 If a new date is given">
          <P>
            Your ticket remains valid for the new date unless the organiser tells you otherwise. Whether you can claim a
            refund instead depends on what the organiser published on the event page, and our postponement email points
            you to it. Some organisers publish that a postponement carries no refund, which is permitted.
          </P>
        </Sub>
        <Sub title="8.4 The limits on a new date">
          <P>Three rules apply to any new date, and all must be met:</P>
          <Ul items={[
            'it must be confirmed within 30 days of the postponement;',
            'it must fall within 30 days of the original event date;',
            'it must be at least 7 days after the day it is confirmed, so that you are given reasonable notice.',
          ]} />
          <P>If the organiser cannot meet all three, or confirms nothing within 30 days, the event is treated as cancelled and the claim window opens.</P>
        </Sub>
        <Sub title="8.5 A change of time on the same day">
          <P>
            Moving the start time while keeping the same date is not a postponement and does not open a refund window.
            Your ticket stays valid. The time cannot be changed within 2 days of the event.
          </P>
        </Sub>
        <Sub title="8.6 Before any ticket is sold">
          <P>An organiser can change the date, venue or time freely while no tickets have been sold. Nothing has been bought, so nothing in this section applies.</P>
        </Sub>
      </Section>

      <Section id="headliners" title="9. Billed headliners who do not appear">
        <Sub title="9.1 Headliner billing carries protection">
          <P>
            Where an organiser bills an act as Headliner and that act does not appear, you may claim a refund. This
            applies on every event and is not something an organiser can opt out of.
          </P>
        </Sub>
        <Sub title="9.2 Why the billing decides it">
          <P>
            A headline act is usually the reason a ticket sells. If that name is the flyer, you have paid for that name,
            and an organiser who bills it takes on the obligation that comes with it. An organiser who does not want
            that obligation does not bill anyone as Headliner.
          </P>
        </Sub>
        <Sub title="9.3 Other billings">
          <P>
            Guest Artist, Special Guest and Surprise Guest do not carry required protection. Whether a refund is
            available if they do not appear is the organiser&apos;s published choice, shown on the event page before you
            pay.
          </P>
        </Sub>
        <Sub title="9.4 How to claim">
          <P>
            Claims must be made within 24 hours after the event ends, using the claim link sent to ticket holders.
            Ventry verifies the claim with the organiser and, where necessary, the venue, before it is passed on. Where
            Ventry is still holding funds for the event, those funds are held while the claim is verified.
          </P>
        </Sub>
      </Section>

      <Section id="address-reveal" title="10. Events where the address is revealed later">
        <Sub title="10.1 What this is">
          <P>Some organisers hold back the exact address of an event and reveal it closer to the date. Ventry allows it, within limits.</P>
        </Sub>
        <Sub title="10.2 What you always see before you pay">
          <P>The date is always shown and can never be hidden. The city and the local government area are always shown. Only the street address is held back.</P>
        </Sub>
        <Sub title="10.3 When it is revealed">
          <P>
            The organiser sets a reveal time when they list the event, and it can never be later than 24 hours before
            doors open. When the address is released, Ventry emails it to every ticket holder.
          </P>
        </Sub>
        <Sub title="10.4 If the address does not suit you">
          <P>
            There is no refund. You knew the date, the city and the local government area before you paid, and the
            venue is within the area you were shown. Deciding afterwards that you would rather not go is a change of
            mind.
          </P>
          <P>
            If the revealed address is not in the city or local government area advertised, that is a different matter.
            Report it to <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a> and we
            will treat it as a misrepresented event.
          </P>
        </Sub>
      </Section>

      <Section id="reselling" title="11. Reselling a ticket">
        <Sub title="11.1 Private resale is your own business">
          <P>If you cannot attend and pass your ticket to someone else privately, that is between you and them. Ventry takes no part in it, earns nothing from it, and accepts no responsibility for it.</P>
        </Sub>
        <Sub title="11.2 What that means in practice">
          <P>
            A QR code admits one person once. If a ticket is sold or given to more than one person, the first to be
            scanned gets in and everyone else does not, and Ventry will not refund or replace their ticket. If you pay
            someone for a ticket outside Ventry and it does not work, we cannot help you and you have no claim against
            us or against the organiser.
          </P>
        </Sub>
        <Sub title="11.3 Only tickets bought on Ventry are ours to stand behind">
          <P>Ventry is responsible only for tickets bought through ventrybooking.com. Anything bought from a third party sits entirely outside this policy.</P>
        </Sub>
        <Sub title="11.4 Bulk and commercial resale is banned">
          <P>You must not buy tickets in bulk for resale, offer tickets for commercial resale, or use bots, scripts or multiple accounts to acquire them. Tickets obtained this way are cancelled without refund and the account is closed.</P>
        </Sub>
      </Section>

      <Section id="ventry-direct-refunds" title="12. When Ventry refunds you directly">
        <Sub title="12.1 Funds we still hold">
          <P>Where an event is cancelled and Ventry is still holding funds for it, we refund the base ticket price on those tickets automatically. No claim is needed. Fees are not refunded.</P>
        </Sub>
        <Sub title="12.2 Where Ventry got it wrong">
          <P>
            Where the failure is ours, we refund everything you paid, including the service fee and the processing fee.
            This covers a payment taken with no valid ticket issued or delivered, a valid ticket rejected at the door
            because of an error on our side, and any other case where you did not receive the ticketing service you paid
            Ventry for.
          </P>
          <P>
            Before claiming under this section, check your spam folder and try the ticket retrieval tool at{' '}
            <Link href="/retrieve" style={{ color: 'var(--color-purple-light)' }}>ventrybooking.com/retrieve</Link>. If
            you still cannot find your ticket, write to{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a> from the address used
            for the purchase.
          </P>
        </Sub>
        <Sub title="12.3 These are the only cases">
          <P>Outside sections 12.1 and 12.2, Ventry does not issue refunds.</P>
        </Sub>
      </Section>

      <Section id="fraud-reporting" title="13. Fraud, reporting, and funds we still hold">
        <Sub title="13.1 Ventry settles quickly">
          <P>Ticket money is settled to organisers on the next working day after a sale. For most of an event&apos;s sales period Ventry is not holding the money.</P>
        </Sub>
        <Sub title="13.2 When we hold funds">
          <P>We may hold settlement where we suspect fraud, where buyer complaints reach a level or kind that concerns us, where we detect unusual purchasing patterns, where a chargeback is raised, or where an event is cancelled or postponed.</P>
        </Sub>
        <Sub title="13.3 What we do with held funds">
          <P>Where an event is cancelled, or an investigation shows fraud or that buyers have paid for something they will not receive, we refund the base ticket price on the funds we are holding to the buyers they came from.</P>
        </Sub>
        <Sub title="13.4 The limits of it">
          <P>This applies only to money we still hold at the time, which is usually a small part of an event&apos;s sales. It does not extend to money already settled, and it does not make Ventry responsible for the organiser&apos;s refunds.</P>
        </Sub>
        <Sub title="13.5 Reporting fraud">
          <P>
            If you believe an event is fraudulent or an organiser is not who they claim to be, write to{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a> with the event name
            and link and what has concerned you. We investigate every report.
          </P>
          <P>
            Reporting to Ventry is not a substitute for reporting to the police, and it does not affect your right to
            pursue the organiser yourself. Where we are required to by law, or where we receive a lawful request or
            court order, we disclose information to law enforcement, regulators and courts.
          </P>
        </Sub>
      </Section>

      <Section id="chargebacks" title="14. Chargebacks">
        <Sub title="14.1 Come to us first">
          <P>
            If you raise a payment dispute with your bank instead of using the process in this policy, the dispute is
            decided by your bank and card scheme under their rules, not by Ventry. Contact the organiser, and then us,
            before going to your bank. It is usually faster, and a chargeback raised on an event that is going ahead
            can result in your ticket being cancelled.
          </P>
        </Sub>
        <Sub title="14.2 Disputes raised without a proper basis">
          <P>Raising a chargeback on a ticket you used, or on a ticket where no refund is due under this policy, is taking a service without paying for it. Where that happens:</P>
          <Ul items={[
            'the ticket is cancelled and your account is closed;',
            'the amount charged back, together with any fee our processor charges us, becomes a debt owed to Ventry and we will ask you for it;',
            'where the amount is significant, or there is a pattern of it, we will pursue recovery, including through the courts, and may refer the matter to law enforcement.',
          ]} />
          <P>Ticket prices on Ventry reach into the millions of naira, so this is not a theoretical position.</P>
        </Sub>
      </Section>

      <Section id="changes-contact" title="15. Changes to this policy, and contact">
        <Sub title="15.1 Changes">
          <P>We may change this policy. The current version is published on ventrybooking.com with its version number and effective date. The version in force when you bought your ticket applies to that purchase.</P>
        </Sub>
        <Sub title="15.2 Contact">
          <P>Ventry Solutions, RC BN9586934, Abuja, Federal Capital Territory, Nigeria.</P>
          <P>
            Buyer support, refund questions and fraud reports:{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>
          </P>
          <P>ventrybooking.com</P>
        </Sub>
      </Section>

      <div
        className="pt-8 border-t flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
      >
        <span>&copy; {new Date().getFullYear()} Ventry. All rights reserved.</span>
        <div className="flex gap-4">
          <Link href="/terms/buyers" style={{ color: 'var(--color-purple-light)' }}>Buyer Terms</Link>
          <Link href="/terms/organisers" style={{ color: 'var(--color-purple-light)' }}>Organiser Terms</Link>
          <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>
        </div>
      </div>
    </LegalLayout>
  );
}
