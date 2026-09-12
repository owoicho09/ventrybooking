import Link from 'next/link';
import { LegalLayout, Section, Sub, P, Ul, Table } from '@/components/legal/LegalDoc';
import { LEGAL_VERSIONS } from '@/lib/legalVersions';

const VERSION   = LEGAL_VERSIONS.buyerTerms.version;
const EFFECTIVE = LEGAL_VERSIONS.buyerTerms.effective;
const EMAIL     = 'support@ventrybooking.com';

const toc = [
  { id: 'about',           label: '1. About these terms' },
  { id: 'what-ventry-is',  label: '2. What Ventry is, and what Ventry is not' },
  { id: 'checks',          label: '3. Checks we carry out on organisers and events' },
  { id: 'account-guest',   label: '4. Your account, and buying as a guest' },
  { id: 'buying-using',    label: '5. Buying a ticket, and using it' },
  { id: 'fees',            label: '6. Prices and fees' },
  { id: 'refunds-claims',  label: '7. Refunds, claims and the claim window' },
  { id: 'changes',         label: '8. Cancellation, postponement and changes' },
  { id: 'headliners',      label: '9. Billed headliners who do not appear' },
  { id: 'resale',          label: '10. Reselling a ticket' },
  { id: 'fraud-reporting', label: '11. Reporting fraud' },
  { id: 'conduct',         label: '12. Your conduct, and suspension of accounts' },
  { id: 'chargebacks',     label: '13. Chargebacks' },
  { id: 'disclosure-data', label: '14. Information we may disclose, and your personal data' },
  { id: 'liability',       label: '15. Our liability to you' },
  { id: 'contact',         label: '16. Changes to these terms, disputes and contact' },
];

export default function BuyerTermsPage() {
  return (
    <LegalLayout
      title="Buyer Terms of Use"
      version={VERSION}
      effective={EFFECTIVE}
      toc={toc}
      intro={
        <>
          Please read section 2 and section 7 carefully. They explain that Ventry provides the ticketing platform only, that
          your contract for the event is with the event organiser, and that Ventry does not issue refunds except in the
          limited cases described.
        </>
      }
    >
      <Section id="about" title="1. About these terms">
        <Sub title="1.1 Who we are">
          <P>
            Ventry Solutions (&quot;Ventry&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a business registered
            in Nigeria under registration number BN9586934, with its address in Abuja, Federal Capital Territory. We operate
            ventrybooking.com and the services available on it.
          </P>
        </Sub>
        <Sub title="1.2 What these terms cover">
          <P>
            These Buyer Terms of Use (&quot;these Terms&quot;) govern your use of Ventry as a person who browses events, buys
            tickets, or holds a ticket bought through Ventry. Separate{' '}
            <Link href="/terms/organisers" style={{ color: 'var(--color-purple-light)' }}>Organiser Terms of Use</Link> apply
            to event organisers, and a separate{' '}
            <Link href="/terms/affiliates" style={{ color: 'var(--color-purple-light)' }}>Affiliate Programme Policy</Link>{' '}
            applies to affiliates. Our{' '}
            <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link> forms part of these
            Terms.
          </P>
        </Sub>
        <Sub title="1.3 You must agree to these terms">
          <P>
            You are asked to confirm that you have read and agreed to these Terms in two places: when you create a buyer
            account, and again before you complete any ticket purchase, including as a guest. You cannot create an account or
            buy a ticket without agreeing. If you do not agree to them, do not use Ventry.
          </P>
        </Sub>
        <Sub title="1.4 Who may buy">
          <P>
            You must be at least 18 years old to buy a ticket on Ventry. Individual events may set a higher age limit, and the
            organiser or the venue may refuse admission if you do not meet it.
          </P>
        </Sub>
        <Sub title="1.5 Words used in these terms">
          <P>
            &quot;Organiser&quot; means the person, business or entity that creates an event listing on Ventry and is
            responsible for holding that event. &quot;Event&quot; means an event listed on Ventry. &quot;Ticket&quot; means an
            electronic ticket issued through Ventry. &quot;Base ticket price&quot; means the amount set by the organiser for a
            ticket, before any fees are added. &quot;Working day&quot; means Monday to Friday, excluding public holidays in
            Nigeria.
          </P>
        </Sub>
      </Section>

      <Section id="what-ventry-is" title="2. What Ventry is, and what Ventry is not">
        <Sub title="2.1 Ventry provides the ticketing platform">
          <P>
            Ventry is a technology platform. We provide the tools that allow organisers to list events, sell tickets, and
            check attendees in at the door, and that allow you to find events and buy tickets.
          </P>
        </Sub>
        <Sub title="2.2 Ventry is not the organiser of any event">
          <P>Unless we state clearly on the event page that Ventry is the organiser, Ventry is not:</P>
          <Ul items={[
            'the organiser, promoter or host of the event;',
            'the operator or owner of the venue;',
            'a sponsor of the event;',
            'a performer at the event;',
            'a party to the agreement between you and the organiser.',
          ]} />
        </Sub>
        <Sub title="2.3 Your contract is with the organiser">
          <P>
            When you buy a ticket through Ventry, you enter into a contract with the organiser of that event, not with Ventry.
            The organiser is solely responsible for holding the event, for what happens at it, and for anything the event
            promises. Ventry is responsible for the ticketing service.
          </P>
        </Sub>
        <Sub title="2.4 Ventry collects payment on the organiser's behalf">
          <P>
            Ventry collects the money you pay as the organiser&apos;s limited collection agent. The money you pay for a ticket
            is received by Ventry on behalf of the organiser and settled to them under our arrangements with them, normally on
            the next working day after your purchase.
          </P>
        </Sub>
        <Sub title="2.5 What this means for you">
          <P>
            Payment to Ventry discharges your obligation to pay the organiser for the ticket. You do not have to pay the
            organiser again. It also means the money is the organiser&apos;s money once collected, and that a claim for a
            refund is in most cases a claim against the organiser rather than against Ventry.
          </P>
        </Sub>
      </Section>

      <Section id="checks" title="3. Checks we carry out on organisers and events">
        <Sub title="3.1 What we do">
          <P>We carry out the checks we consider appropriate before an organiser can sell and before an event goes live. Depending on the organiser and the event, these may include:</P>
          <Ul items={[
            'verifying the organiser’s identity through a licensed verification provider, using their National Identification Number, or their Corporate Affairs Commission registration where the organiser is a registered business;',
            'confirming that the settlement account they have given us matches their verified legal name or registered entity;',
            'requiring something in writing that names the venue, the event and the date, together with a venue contact we can reach to confirm the booking;',
            'reviewing the event listing before it is published.',
          ]} />
        </Sub>
        <Sub title="3.2 What the Verified badge means">
          <P>
            Where an organiser has supplied documented venue proof and Ventry has confirmed the booking with the venue, the
            event carries a Verified badge. The badge means that and nothing more: Ventry contacted the venue and confirmed
            the booking for that date.
          </P>
        </Sub>
        <Sub title="3.3 What we do not promise">
          <P>These checks reduce risk. They do not remove it. Ventry does not guarantee, and gives no warranty, that:</P>
          <Ul items={[
            'any event will take place, or will take place as described;',
            'any organiser will perform their obligations to you;',
            'any organiser will pay a refund that is due;',
            'any information supplied by an organiser and displayed on Ventry is accurate.',
          ]} />
          <P>A verification badge confirms that we have carried out our checks. It is not a guarantee about the event and must not be relied on as one.</P>
        </Sub>
        <Sub title="3.4 Tell us if something looks wrong">
          <P>
            If you believe an event listing is fraudulent or misleading, or that an organiser is not who they claim to be,
            report it to <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>. We
            investigate every report. Section 11 explains what we can and cannot do.
          </P>
        </Sub>
      </Section>

      <Section id="account-guest" title="4. Your account, and buying as a guest">
        <Sub title="4.1 Buying without an account">
          <P>
            You can buy a ticket as a guest without creating an account. If you do, your ticket and all communications about
            it are sent to the email address you give at checkout, and you are asked to agree to these Terms before payment.
          </P>
        </Sub>
        <Sub title="4.2 If you create an account">
          <P>
            You must agree to these Terms, give accurate information, keep it up to date, and keep your login details
            private. You are responsible for everything done through your account.
          </P>
        </Sub>
        <Sub title="4.3 Your email address">
          <P>
            Your ticket is delivered to the email address you provide. It is your responsibility to enter it correctly and to
            check your inbox, including your spam folder. If you enter an incorrect address, contact us and we will resend the
            ticket to the correct address once we have confirmed the purchase.
          </P>
        </Sub>
      </Section>

      <Section id="buying-using" title="5. Buying a ticket, and using it">
        <Sub title="5.1 How tickets are issued">
          <P>
            Tickets are issued electronically. After a successful payment you receive a confirmation email containing your
            ticket, your ticket ID and a QR code. The QR code is scanned at the door to admit you.
          </P>
        </Sub>
        <Sub title="5.2 Your ticket is only valid once">
          <P>
            Each QR code admits one person once. Once it has been scanned it cannot be used again. Do not share your ticket or
            its QR code with anyone. If someone else uses it before you arrive, you will not be admitted and you will not be
            entitled to a refund.
          </P>
        </Sub>
        <Sub title="5.3 If you cannot find your ticket">
          <P>
            You can retrieve a ticket you have lost at{' '}
            <Link href="/retrieve" style={{ color: 'var(--color-purple-light)' }}>ventrybooking.com/retrieve</Link>, or by
            contacting <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a> with the email
            address used for the purchase.
          </P>
        </Sub>
        <Sub title="5.4 Admission is controlled by the organiser and the venue">
          <P>
            Holding a valid ticket does not guarantee admission. The organiser and the venue control admission and may refuse
            entry, including on grounds of age, capacity, dress code, intoxication, conduct or security. Ventry has no control
            over admission decisions and is not responsible for them.
          </P>
        </Sub>
        <Sub title="5.5 Event information">
          <P>
            All event information on Ventry, including the date, time, venue, description, images and any lineup, is supplied
            by the organiser. Ventry publishes it as supplied. We do not verify it beyond the checks in section 3 and we make
            no representation that it is accurate.
          </P>
        </Sub>
        <Sub title="5.6 Hidden addresses">
          <P>
            Some organisers hold back the street address of an event and reveal it closer to the date. The date is always
            shown and can never be hidden, and the city and local government area are always shown. The reveal happens no
            later than 24 hours before doors open, and Ventry emails the address to every ticket holder at that point.
            Deciding after the reveal that the venue does not suit you is a change of mind and no refund is available.
          </P>
        </Sub>
      </Section>

      <Section id="fees" title="6. Prices and fees">
        <Sub title="6.1 The three amounts you pay">
          <Table
            head={['Amount', 'Who sets it', 'Who receives it']}
            rows={[
              ['Base ticket price', 'The organiser', 'The organiser'],
              ['Ventry service fee', 'Ventry', 'Ventry'],
              ['Payment processing fee', 'The payment processor', 'The payment processor'],
            ]}
          />
        </Sub>
        <Sub title="6.2 The Ventry service fee">
          <P>
            2% of the base ticket price for tickets priced below NGN 150,000. For tickets priced at NGN 150,000 or above, a
            flat NGN 3,000 per ticket.
          </P>
          <P>
            This fee pays for the service Ventry provides to you: issuing your ticket, delivering it, sending your
            confirmation and any reminders, operating the QR code and check-in system, and providing ticket retrieval and
            buyer support.
          </P>
        </Sub>
        <Sub title="6.3 The payment processing fee">
          <P>
            1.5% of the transaction total, plus NGN 100 on transactions above NGN 2,500, capped at NGN 2,000 per transaction
            and rounded up to the next naira. It is charged by our payment processor and is not retained by Ventry.
          </P>
        </Sub>
        <Sub title="6.4 Worked example">
          <Table
            head={['Item', 'Amount']}
            rows={[
              ['Base ticket price set by the organiser', 'NGN 10,000'],
              ['Ventry service fee, 2%', 'NGN 200'],
              ['Subtotal', 'NGN 10,200'],
              ['Processing fee, 1.5% of NGN 10,200 plus NGN 100', 'NGN 253'],
              [<strong key="t">Total you pay</strong>, <strong key="a">NGN 10,453</strong>],
            ]}
          />
          <P>The exact total is always shown to you before you confirm your purchase. You will never be charged more than the total displayed at checkout.</P>
        </Sub>
        <Sub title="6.5 Fees are not refundable">
          <P>
            The Ventry service fee and the payment processing fee are not refundable, including where an event is cancelled
            or postponed. The service fee is charged for a service Ventry has already performed at the point your ticket is
            issued. The processing fee has already been paid to the payment processor and is not returned to Ventry when a
            payment is reversed.
          </P>
          <P>The only exception is section 15.5, where the failure is Ventry&apos;s own. Otherwise, where a refund is due to you, it is a refund of the base ticket price.</P>
        </Sub>
      </Section>

      <Section id="refunds-claims" title="7. Refunds, claims and the claim window">
        <P>
          Ventry refunds you only where Ventry is still holding the money for a cancelled event, or where Ventry itself
          failed to deliver your ticket. In every other case the organiser pays, under the refund policy published on their
          event page.
        </P>
        <Sub title="7.1 Where Ventry refunds automatically">
          <P>
            If an event is cancelled while Ventry is still holding funds for it, we refund the base ticket price on those
            tickets automatically. You do not need to claim. Fees are not refunded. This applies only to money we still hold
            at the time of the cancellation, which is usually a small part of an event&apos;s sales.
          </P>
        </Sub>
        <Sub title="7.2 Where the organiser refunds">
          <P>
            Because your contract for the event is with the organiser, and because ticket money is settled to them on the next
            working day, any refund beyond section 7.1 is owed to you by the organiser. Ventry does not fund it and is not
            liable for a refund an organiser fails to pay.
          </P>
        </Sub>
        <Sub title="7.3 Every event publishes a refund policy">
          <P>
            Before an event can go live, the organiser answers five questions and Ventry generates a refund policy from their
            answers. It is published on the event page and shown again at checkout, so you see it before you pay. The
            organiser chooses how quickly they pay a valid claim, being within 7, 14 or 30 days, and what happens on a
            postponement, a venue change more than 7 days out, and the non-appearance of a Guest or Special Guest. They do not
            choose the amount. Every organiser refunds the full base ticket price.
          </P>
        </Sub>
        <Sub title="7.4 No refunds for changing your mind">
          <P>
            No organiser on Ventry offers a refund because you decided not to attend, could not make it, or changed your
            mind. That option does not exist on the platform. Buy a ticket only if you intend to use it.
          </P>
        </Sub>
        <Sub title="7.5 The minimum standards Ventry requires">
          <P>Whatever an organiser publishes, Ventry requires as a minimum that:</P>
          <Ul items={[
            'where an event is cancelled, the organiser refunds the full base ticket price to every buyer who claims within the claim window;',
            'where an event is postponed and no valid new date is confirmed, it is treated as a cancellation and the claim window opens;',
            'where the venue or date changes within 7 days of the event, it is treated as a cancellation;',
            'where an act billed as Headliner does not appear, buyers may claim;',
            'the organiser provides an email address for refund questions and responds within five working days.',
          ]} />
          <P>Partial refunds on cancellation and policies of no refund on cancellation are not available on Ventry. Where an organiser&apos;s published policy is narrower than this section, this section applies.</P>
        </Sub>
        <Sub title="7.6 You must claim, and there is a deadline">
          <P>
            Organisers do not hold your contact details. Ventry does. That means an organiser cannot refund you unless you
            come forward, so a refund on a cancelled event starts with a claim from you.
          </P>
          <P>
            You have 30 days to claim, running from the date Ventry sends the first cancellation notice. A claim made after
            that window closes is not paid. We email you on the day of the cancellation and again on days 15, 25 and 30 if you
            have not claimed.
          </P>
        </Sub>
        <Sub title="7.7 How to claim">
          <P>
            Your cancellation email contains your ticket ID and a refund ID unique to your ticket. You submit both, together
            with the bank account the refund should be paid to, using the claim link in that email. Your claim must be
            submitted from, or verified against, the email address used to buy the ticket.
          </P>
        </Sub>
        <Sub title="7.8 The claim list">
          <P>
            Ventry collects every claim across the 30-day window and then sends the organiser one complete list, with the bank
            details each buyer supplied. The organiser&apos;s deadline to pay, being the 7, 14 or 30 days they published, runs
            from the date we send that list.
          </P>
          <P>
            We do it as a single list rather than passing claims through as they arrive so that the organiser sees their whole
            liability at once instead of paying whoever claimed first and running out, so that every buyer on the list is
            treated the same, and so that anyone Ventry has already refunded under section 7.1 can be marked as paid and not
            refunded twice.
          </P>
          <P>The longest total wait is therefore 30 days of collection followed by up to 30 days for the organiser to pay.</P>
        </Sub>
        <Sub title="7.9 If the organiser does not pay">
          <P>
            Write to <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a> with the event
            name, your ticket ID and your refund ID. We will take it up with the organiser and require proof of payment from
            them. Where an organiser cannot show they paid a valid claim, the failure is recorded against their account, and
            repeated failures result in suspension or permanent removal from Ventry.
          </P>
          <P>
            We must be clear about the limits. Ventry can apply pressure, record the failure, hold settlement on their other
            events, and remove them. Ventry cannot compel an organiser to pay you and will not pay you in their place.
          </P>
        </Sub>
      </Section>

      <Section id="changes" title="8. Cancellation, postponement and changes">
        <Sub title="8.1 Ventry's role">
          <P>
            Organisers are required to tell us immediately if an event is cancelled, postponed or materially changed. When
            they do, we notify affected buyers by email using the details supplied to us.
          </P>
        </Sub>
        <Sub title="8.2 Cancellation">
          <P>
            We email you the same day with your ticket ID, your refund ID and a claim link, and again on days 15, 25 and 30
            if you have not claimed. Where Ventry still holds funds, the base ticket price on those tickets is refunded
            automatically without any claim.
          </P>
        </Sub>
        <Sub title="8.3 Postponement">
          <P>
            An event can be postponed once after tickets have gone on sale, and a change of venue counts as that one
            postponement. If the organiser needs to move it again, it is treated as a cancellation and the claim window
            opens.
          </P>
          <P>
            When an event is postponed we email you and, where the organiser has given one, tell you the new date. Your
            ticket remains valid for that date unless the organiser tells you otherwise. Whether you can claim a refund
            instead depends on the policy published on the event page, and our email points you to it. An organiser may
            publish that a postponement carries no refund, which is permitted where a valid new date is confirmed.
          </P>
        </Sub>
        <Sub title="8.4 The limits on a new date">
          <P>
            A new date must be confirmed within 30 days of the postponement, must fall within 30 days of the original event
            date, and must be at least 7 days after the day it is confirmed. If the organiser cannot meet all three, or
            confirms nothing within 30 days, the event is treated as cancelled and the claim window opens.
          </P>
        </Sub>
        <Sub title="8.5 Nothing can move within 7 days of the event">
          <P>A postponement or a change of venue inside 7 days of the event date is treated as a cancellation, whatever the organiser calls it.</P>
        </Sub>
        <Sub title="8.6 A change of time on the same day">
          <P>
            Moving the start time while keeping the same date is not a postponement and does not open a refund window. Your
            ticket stays valid. The time cannot be changed within 2 days of the event.
          </P>
        </Sub>
        <Sub title="8.7 Before any ticket is sold">
          <P>An organiser can change the date, venue or time freely while no tickets have been sold. Nothing in this section applies at that stage.</P>
        </Sub>
      </Section>

      <Section id="headliners" title="9. Billed headliners who do not appear">
        <Sub title="9.1 Headliner billing carries protection">
          <P>
            Where an organiser bills an act as Headliner and that act does not appear, you may claim a refund. This applies
            on every event on Ventry and no organiser can opt out of it.
          </P>
        </Sub>
        <Sub title="9.2 Other billings">
          <P>Guest Artist, Special Guest and Surprise Guest do not carry required protection. Whether a refund is available if they do not appear is the organiser&apos;s published choice, shown on the event page before you pay.</P>
        </Sub>
        <Sub title="9.3 Claiming">
          <P>
            Claims must be made within 24 hours after the event ends, using the claim link sent to ticket holders. Ventry
            verifies the claim with the organiser and, where necessary, the venue. Where Ventry is still holding funds for the
            event, those funds are held while the claim is verified.
          </P>
        </Sub>
      </Section>

      <Section id="resale" title="10. Reselling a ticket">
        <Sub title="10.1 Private resale is your own business">
          <P>If you cannot attend and pass your ticket to someone else privately, that is between you and them. Ventry takes no part in it, earns nothing from it, and accepts no responsibility for it.</P>
        </Sub>
        <Sub title="10.2 What that means in practice">
          <P>
            A QR code admits one person once. If a ticket is sold or given to more than one person, the first to be scanned
            gets in and everyone else does not, and Ventry will not refund or replace their ticket. If you pay someone for a
            ticket outside Ventry and it does not work, we cannot help you and you have no claim against us or against the
            organiser.
          </P>
        </Sub>
        <Sub title="10.3 Only tickets bought on Ventry are ours to stand behind">
          <P>
            Ventry is responsible only for tickets bought through ventrybooking.com. Anything bought from a third party sits
            entirely outside these Terms.
          </P>
        </Sub>
        <Sub title="10.4 Bulk and commercial resale is banned">
          <P>
            You must not buy tickets in bulk for resale, offer tickets for commercial resale, or use bots, scripts or
            multiple accounts to acquire them. Tickets obtained this way are cancelled without refund and the account is
            closed.
          </P>
        </Sub>
      </Section>

      <Section id="fraud-reporting" title="11. Reporting fraud">
        <Sub title="11.1 How to report">
          <P>Write to <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a> with the event name and link, and what has led you to be concerned.</P>
        </Sub>
        <Sub title="11.2 What we will do">
          <P>
            We investigate. Where appropriate we may hold settlement of funds for that event, refund the base ticket price on
            funds we still hold, take the event down, suspend or remove the organiser&apos;s account, and cooperate with law
            enforcement or any other competent authority.
          </P>
        </Sub>
        <Sub title="11.3 What we cannot do">
          <P>
            We cannot recover money already settled to an organiser, and we cannot refund you in their place beyond funds we
            still hold. Reporting fraud to Ventry is not a substitute for reporting it to the police, and it does not affect
            your right to pursue the organiser yourself.
          </P>
        </Sub>
      </Section>

      <Section id="conduct" title="12. Your conduct, and suspension of accounts">
        <Sub title="12.1 Using your ticket">
          <P>You may use your ticket only for the event it was issued for, and only in accordance with the rules of the organiser and the venue.</P>
        </Sub>
        <Sub title="12.2 What is not allowed">
          <P>You must not:</P>
          <Ul items={[
            'buy tickets in bulk for resale, or offer tickets for commercial resale;',
            'copy, duplicate, forge or alter a ticket or QR code;',
            'buy tickets using a payment method you are not authorised to use;',
            'use bots, scripts or automated tools to buy tickets;',
            'create multiple accounts to get around purchase limits;',
            'impersonate another person or provide false information;',
            'raise a payment dispute without a proper basis;',
            'use Ventry for any unlawful purpose, including money laundering or the financing of terrorism;',
            'upload or transmit malicious code, or attempt to interfere with, scrape or reverse engineer the platform.',
          ]} />
        </Sub>
        <Sub title="12.3 If you breach this section">
          <P>We may cancel any ticket obtained in breach of this section without refund, suspend or close your account, restrict your access to Ventry, and report the matter to law enforcement.</P>
        </Sub>
        <Sub title="12.4 Notice">
          <P>We notify you by email when we suspend or close your account, unless we are prevented from doing so by law or by a competent authority.</P>
        </Sub>
      </Section>

      <Section id="chargebacks" title="13. Chargebacks">
        <Sub title="13.1 Use our process first">
          <P>
            If you raise a payment dispute with your bank instead of contacting us first, the dispute is
            decided by your bank and card scheme under their rules, not by Ventry. A chargeback raised on an event that is
            going ahead can result in your ticket being cancelled.
          </P>
        </Sub>
        <Sub title="13.2 Disputes raised without a proper basis">
          <P>
            Raising a chargeback on a ticket you used, or on a ticket where no refund is due, is taking a service without
            paying for it. Where that happens the ticket is cancelled and your account is closed, the amount charged back
            together with any processor fee becomes a debt owed to Ventry, and where the amount is significant or there is a
            pattern of it we will pursue recovery including through the courts and may refer the matter to law enforcement.
          </P>
        </Sub>
      </Section>

      <Section id="disclosure-data" title="14. Information we may disclose, and your personal data">
        <Sub title="14.1 To authorities">
          <P>
            We may disclose information we hold, including information about buyers and organisers, to law enforcement
            agencies, regulators, courts or other competent authorities where required by law, where we receive a lawful
            request or court order, or where we consider disclosure necessary to investigate suspected fraud or other
            unlawful activity.
          </P>
        </Sub>
        <Sub title="14.2 To other users">
          <P>
            We do not release an organiser&apos;s personal information to buyers, and we do not release a buyer&apos;s
            personal information to organisers except as needed to run the event, such as attendee lists for check-in and the
            bank details you supply with a refund claim. If you are pursuing an organiser through the courts, the route to
            their details is an order from a court or a request from the police, not a request to Ventry.
          </P>
        </Sub>
        <Sub title="14.3 Your personal information">
          <P>
            We process personal information in accordance with the Nigeria Data Protection Act 2023 and our{' '}
            <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>. Organisers receive
            attendee information necessary to run their events and are independently responsible for how they use it.
          </P>
        </Sub>
      </Section>

      <Section id="liability" title="15. Our liability to you">
        <Sub title="15.1 What we are responsible for">
          <P>
            This section limits what Ventry can be held liable for, so it starts with what we do accept. We are responsible
            for providing the ticketing service you pay us for: taking your payment, issuing your ticket, delivering it to
            you, operating the QR and check-in system, providing ticket retrieval, and running the notification and claim
            processes described in these Terms. If we fail at any of that, section 15.5 applies and we put it right.
          </P>
        </Sub>
        <Sub title="15.2 What we are not responsible for">
          <P>We are not responsible for the event itself or for anything arising from it. This includes:</P>
          <Ul items={[
            'the cancellation, postponement or alteration of any event;',
            'the quality, safety or content of any event;',
            'any performer failing to appear;',
            'refusal of admission by the organiser or the venue;',
            'any loss, injury or damage suffered at or in connection with an event;',
            'any refund an organiser owes you and does not pay;',
            'any ticket you bought from someone other than Ventry;',
            'any act or omission of an organiser, venue, performer or payment processor.',
          ]} />
        </Sub>
        <Sub title="15.3 Limit on our liability">
          <P>
            Where Ventry is liable to you, our total liability in connection with any event is limited to the total fees
            Ventry received from you in connection with that event. We are not liable for indirect or consequential loss,
            loss of profit, loss of enjoyment, wasted expenditure such as travel or accommodation, or reputational damage.
          </P>
        </Sub>
        <Sub title="15.4 What we do not exclude">
          <P>Nothing in these Terms excludes or limits liability that cannot be excluded or limited under Nigerian law, including liability for fraud or for death or personal injury caused by our negligence.</P>
        </Sub>
        <Sub title="15.5 Where the failure is ours">
          <P>
            Where you did not receive the ticketing service you paid Ventry for, we refund everything you paid including the
            service fee and the processing fee. This covers a payment taken with no valid ticket issued or delivered, and a
            valid ticket rejected at the door because of an error on our side.
          </P>
        </Sub>
        <Sub title="15.6 Events outside our control">
          <P>
            Ventry is not liable for any failure or delay in providing the platform caused by events outside our reasonable
            control, including internet or power failure, failure of a payment processor or other third-party provider,
            cyberattack, government action, civil unrest, natural disaster, epidemic or pandemic.
          </P>
        </Sub>
      </Section>

      <Section id="contact" title="16. Changes to these terms, disputes and contact">
        <Sub title="16.1 Changes">
          <P>
            We may change these Terms. The current version is always published on ventrybooking.com with its version number
            and effective date. The version in force at the time you buy a ticket governs that purchase, and a later change
            does not affect a ticket you have already bought.
          </P>
        </Sub>
        <Sub title="16.2 Governing law">
          <P>These Terms are governed by the laws of the Federal Republic of Nigeria.</P>
        </Sub>
        <Sub title="16.3 Talk to us first">
          <P>If you have a complaint about Ventry, write to <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>. We will try to resolve it with you directly.</P>
        </Sub>
        <Sub title="16.4 Arbitration">
          <P>
            If a dispute between you and Ventry is not resolved within 30 days of being raised, it shall be referred to
            arbitration in Abuja, Federal Capital Territory, in accordance with the Arbitration and Mediation Act 2023. The
            seat is Abuja, the language is English, and the arbitrator&apos;s decision is final and binding. Nothing in this
            section prevents either party from seeking urgent interim relief from a court.
          </P>
        </Sub>
        <Sub title="16.5 Disputes with organisers">
          <P>This section governs disputes between you and Ventry only. A dispute between you and an organiser is between the two of you, and Ventry is not a party to it.</P>
        </Sub>
        <Sub title="16.6 Contact">
          <Table
            head={['Contact', 'Detail']}
            rows={[
              ['Registered entity', 'Ventry Solutions, RC BN9586934, Abuja, Federal Capital Territory, Nigeria'],
              ['Buyer support, refund questions and fraud reports', <a key="s" href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>],
              ['Platform', 'ventrybooking.com'],
            ]}
          />
        </Sub>
      </Section>

      <div
        className="pt-8 border-t flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
      >
        <span>&copy; {new Date().getFullYear()} Ventry. All rights reserved.</span>
        <div className="flex gap-4">
          <Link href="/terms/organisers" style={{ color: 'var(--color-purple-light)' }}>Organiser Terms</Link>
          <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>
        </div>
      </div>
    </LegalLayout>
  );
}
