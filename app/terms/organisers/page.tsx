import Link from 'next/link';
import { LegalLayout, Section, Sub, P, Ul, Table } from '@/components/legal/LegalDoc';
import { LEGAL_VERSIONS } from '@/lib/legalVersions';

const VERSION   = LEGAL_VERSIONS.organiserTerms.version;
const EFFECTIVE = LEGAL_VERSIONS.organiserTerms.effective;
const EMAIL     = 'support@ventrybooking.com';
const ADMIN_EMAIL = 'admin@ventrybooking.com';

const toc = [
  { id: 'about',                label: '1. About these terms' },
  { id: 'who-may-organise',     label: '2. Who may be an organiser' },
  { id: 'registration',         label: '3. Registration, verification and identity requirements' },
  { id: 'listing',              label: '4. Listing an event' },
  { id: 'inventory',            label: '5. Ticket inventory and selling outside Ventry' },
  { id: 'buyer-relationship',   label: '6. Your relationship with buyers' },
  { id: 'fees',                 label: '7. Fees' },
  { id: 'settlement',           label: '8. Settlement' },
  { id: 'holding-settlement',   label: '9. Holding settlement and investigations' },
  { id: 'cancellation',         label: '10. Cancellation, postponement, changes and the claim list' },
  { id: 'standing',             label: '11. Cancellations, non-payment of refunds, and your standing on Ventry' },
  { id: 'prohibited',           label: '12. Prohibited conduct' },
  { id: 'chargebacks',          label: '13. Chargebacks' },
  { id: 'indemnity',            label: '14. Indemnity' },
  { id: 'suspension',           label: '15. Suspension, takedown and removal' },
  { id: 'disclosure',           label: '16. Information we may disclose' },
  { id: 'data-protection',      label: '17. Data protection' },
  { id: 'content-ip',           label: '18. Content and intellectual property' },
  { id: 'liability',            label: '19. Our liability to you' },
  { id: 'outside-control',      label: '20. Events outside our control' },
  { id: 'term-termination',     label: '21. Term, termination and survival' },
  { id: 'terms-changes',        label: '22. Changes to these terms' },
  { id: 'governing-law',        label: '23. Governing law and arbitration' },
  { id: 'contact',              label: '24. Contact' },
];

export default function OrganiserTermsPage() {
  return (
    <LegalLayout
      title="Organiser Terms of Use"
      version={VERSION}
      effective={EFFECTIVE}
      toc={toc}
      intro={
        <>
          This is the agreement between you and Ventry. Sections 6, 10, 11, 13 and 14 set out obligations that carry
          real financial consequences for you, including your responsibility for refunds and for chargebacks. Read
          them before you list an event.
        </>
      }
    >
      <Section id="about" title="1. About these terms">
        <Sub title="1.1 Who we are">
          <P>
            Ventry Solutions (&ldquo;Ventry&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a business
            registered in Nigeria under registration number BN9586934, with its address in Abuja, Federal Capital
            Territory. We operate ventrybooking.com.
          </P>
        </Sub>
        <Sub title="1.2 What these terms cover">
          <P>
            These Organiser Terms of Use (&ldquo;these Terms&rdquo;) govern your use of Ventry as an event organiser.
            Our <Link href="/terms/buyers" style={{ color: 'var(--color-purple-light)' }} className="hover:underline">Buyer Terms of Use</Link> and{' '}
            <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }} className="hover:underline">Privacy Policy</Link> form part of these Terms.
          </P>
        </Sub>
        <Sub title="1.3 You must agree to these terms">
          <P>
            You are asked to confirm that you have read and agreed to these Terms when you create an organiser
            account. You cannot create an account without agreeing. You are asked again, separately, to confirm the
            accuracy of what you submit when you complete verification and when you submit an event for publication.
          </P>
        </Sub>
        <Sub title="1.4 Words used in these terms">
          <P>
            &ldquo;Buyer&rdquo; means a person who buys a ticket to your event. &ldquo;Event&rdquo; means an event you
            list on Ventry. &ldquo;Ticket price&rdquo; means the amount you set for a ticket, before fees.
            &ldquo;Settlement&rdquo; means the payment of ticket money to you. &ldquo;Working day&rdquo; means Monday
            to Friday, excluding public holidays in Nigeria.
          </P>
        </Sub>
      </Section>

      <Section id="who-may-organise" title="2. Who may be an organiser">
        <Sub title="2.1 Eligibility">
          <P>
            You must be at least 18 years old. If you are acting for a company, partnership or other entity, you
            confirm that you have authority to bind that entity to these Terms.
          </P>
        </Sub>
        <Sub title="2.2 Accurate information">
          <P>
            Everything you tell us about yourself, your business and your events must be true, accurate and complete,
            and you must keep it up to date.
          </P>
        </Sub>
        <Sub title="2.3 Our discretion">
          <P>
            We may approve or decline any organiser registration, and may approve or decline any event listing, at
            our discretion. We are not obliged to give reasons.
          </P>
        </Sub>
      </Section>

      <Section id="registration" title="3. Registration, verification and identity requirements">
        <Sub title="3.1 Creating an account is quick">
          <P>
            To create an organiser account you need only your name, a display name for buyers to see, and a contact
            email address or phone number. You can set up your profile and build an event straight away.
          </P>
        </Sub>
        <Sub title="3.2 Verification is a separate step">
          <P>
            Your profile carries a verification panel showing what is outstanding, and your settlement bank details
            are entered on the payout page rather than at sign-up. You complete verification when you are ready, and
            you will need it before your event goes live and before settlement can continue past the limit in
            section 3.7.
          </P>
        </Sub>
        <Sub title="3.3 Why we verify">
          <P>
            Buyers on Ventry are dealing with you, not with us, and we settle your ticket money to you before your
            event happens. Verification is how we know who is selling on the platform, how buyers gain confidence in
            an organiser they have not bought from before, and how we identify organisers who cause harm.
          </P>
        </Sub>
        <Sub title="3.4 If you are an individual">
          <P>You must provide:</P>
          <Ul items={[
            'your National Identification Number, for verification through a licensed verification provider;',
            'your legal name as it appears against that verification;',
            'a Nigerian bank account in your verified legal name.',
          ]} />
        </Sub>
        <Sub title="3.5 If you are a registered business, organisation or franchise">
          <P>You must provide:</P>
          <Ul items={[
            'your Corporate Affairs Commission registration details;',
            'a Nigerian bank account that aligns with your CAC registration.',
          ]} />
        </Sub>
        <Sub title="3.6 Your display name and your legal name are not the same thing">
          <P>
            Your display name is what buyers see and can be your event or brand name. Your legal name is what we
            verify and what your settlement account must match. We will not settle funds to an account that does not
            match your verified legal name or registered entity, whatever display name you use.
          </P>
        </Sub>
        <Sub title="3.7 Settlement is capped until you are verified">
          <P>
            An unverified organiser can sell tickets and receive settlement up to a cumulative total of NGN 500,000.
            Once that total has been settled to you, further settlement is paused until your verification is
            complete.
          </P>
          <P>
            The limit is cumulative across every event on your account and across your whole history with Ventry. It
            does not reset when you list a new event, and it cannot be reset by opening a second account. Tickets
            keep selling while settlement is paused, and the funds are released once verification completes.
          </P>
        </Sub>
        <Sub title="3.8 Your settlement account">
          <P>
            You may hold one settlement account at a time, entered on the payout page. To change it you must be
            logged in and provide your account password, a one-time password sent to your registered contact, and a
            second one-time password confirming the change. The new account must also match your verified identity.
            Settlement may be paused while a change is processed and verified.
          </P>
        </Sub>
        <Sub title="3.9 Ongoing verification">
          <P>
            We may ask you at any time for further verification, including updated documents, and may suspend your
            account or hold settlement while we wait for it. Failure to provide verification we have requested is a
            breach of these Terms.
          </P>
        </Sub>
        <Sub title="3.10 You confirm your information is accurate">
          <P>
            Before submitting your verification details you must confirm that all the information you have given is
            accurate, complete and belongs to you. Submitting false or altered information is grounds for immediate
            removal from Ventry and may be reported to law enforcement.
          </P>
        </Sub>
        <Sub title="3.11 What our verification means">
          <P>
            Verification confirms your identity to us. It is not an endorsement of you or your events by Ventry, and
            Ventry gives buyers no guarantee about you or your events.
          </P>
        </Sub>
      </Section>

      <Section id="listing" title="4. Listing an event">
        <Sub title="4.1 Your event information">
          <P>
            You are responsible for everything on your event page. All of it must be accurate, must not mislead, and
            must be kept up to date. This includes the date, time, venue, description, images, ticket types, prices,
            capacity, age restrictions and any lineup.
          </P>
        </Sub>
        <Sub title="4.2 Proof of venue">
          <P>
            Before your event carries the Verified badge you must provide two things: something in writing that
            names the venue, the event and the date, and a venue contact Ventry can reach to confirm the booking.
          </P>
          <P>
            Acceptable written evidence includes a signed venue agreement, an invoice or receipt from the venue, a
            deposit receipt where the recipient account matches the venue, or a written confirmation from the
            venue&rsquo;s booking contact. A photograph of a venue is not accepted, and neither is a payment receipt
            that does not name the venue or the date.
          </P>
          <P>
            The document establishes what we are confirming. The call to the venue is what confirms it. Where we
            cannot reach a venue contact who will confirm the booking, your event can still be listed but will not
            carry the badge.
          </P>
          <P>
            Where the venue is private or residential and there is no independent contact to confirm with, the event
            can be listed on your written confirmation alone and will not carry the badge.
          </P>
        </Sub>
        <Sub title="4.3 Lineups and performers">
          <P>
            You must not name a performer, artist, speaker or special guest unless you have a genuine and reasonable
            basis for expecting them to appear. Ventry publishes your lineup as you supply it and makes no
            representation about it. If a named performer does not appear, that is a matter between you and your
            buyers.
          </P>
        </Sub>
        <Sub title="4.4 You must set a refund policy">
          <P>
            Before your event can go live you must answer Ventry&rsquo;s four refund questions. Ventry generates your
            published refund policy from your answers and displays it on your event page and again at checkout, so
            buyers see it before they pay.
          </P>
          <Table
            head={['You are asked', 'Your options']}
            rows={[
              ['If you cancel, how long after receiving the claim list will you refund buyers?', '7, 14 or 30 days'],
              ['If you postpone to a confirmed new date, what happens?', 'All buyers refunded, or ticket stays valid with refund on request, or ticket stays valid with no refund'],
              ['If you change the venue more than 7 days out, what happens?', 'Refund on request, or no refund and the ticket stays valid'],
              ['Which email address should buyers use for refund questions?', 'Your own working address, which you must monitor'],
            ]}
          />
        </Sub>
        <Sub title="4.5 What you do not choose">
          <P>
            You do not choose the amount. Every organiser on Ventry refunds the full base ticket price on a valid
            claim. Partial refunds on cancellation are not available, and no organiser may publish a policy of no
            refunds on cancellation.
          </P>
          <P>You do not choose the claim window. It is fixed at 30 days for every event on Ventry and is set out in section 10.</P>
          <P>
            You do not choose whether headliner protection applies. Where you bill an act as Headliner and that act
            does not appear, buyers may claim. See section 6.7.
          </P>
        </Sub>
        <Sub title="4.6 Your refund contact address">
          <P>
            The address you give is shown to buyers who need it. You must monitor it and respond to refund questions
            within five working days.
          </P>
        </Sub>
        <Sub title="4.7 Review before publication">
          <P>
            We may review your event before it goes live and may ask you to change or remove anything that is
            inaccurate, misleading, unlawful, or that presents a risk to buyers or to Ventry.
          </P>
        </Sub>
        <Sub title="4.8 You confirm your event information is accurate">
          <P>
            Before submitting an event for publication you must confirm that all the information you have given
            about it is accurate and complete, that you have the right to hold the event as described, and that you
            have secured the venue. Submitting an event on a false basis is grounds for immediate takedown and
            removal from Ventry.
          </P>
        </Sub>
        <Sub title="4.9 The date and the venue">
          <P>
            You must enter the date and the full venue address when you list the event, and supply proof of the
            booking. Neither can be left blank.
          </P>
          <P>
            You may hide the street address from buyers until a reveal time you set at listing. The date can never be
            hidden, and the city and the local government area are always shown. The reveal time can be no later
            than 24 hours before doors open. Ventry emails the address to every ticket holder when it is released.
          </P>
          <P>
            Ventry holds and verifies the full address from the moment you list, whether or not it is displayed.
            Hiding it is a display setting, not a gap in our records. The venue you reveal must be in the city and
            local government area you advertised. Revealing a venue outside them is a misrepresented event and is
            dealt with under section 12.
          </P>
        </Sub>
      </Section>

      <Section id="inventory" title="5. Ticket inventory and selling outside Ventry">
        <Sub title="5.1 What you list must be real and available">
          <P>
            Every ticket, table, seat or place you list on Ventry must genuinely exist and must be available to the
            buyer who purchases it. You must not list more inventory than the venue can hold or than you are able to
            honour.
          </P>
        </Sub>
        <Sub title="5.2 You may not sell the same inventory twice">
          <P>
            If you list inventory on Ventry, that inventory is committed to Ventry buyers. You must not sell the same
            units through another channel at the same time.
          </P>
          <P>
            For example, if your event has five tables and you list all five on Ventry, you must not also offer
            those same five tables directly, through another platform, or through any other route. If you intend to
            sell some of your inventory elsewhere, you must list only the portion allocated to Ventry and must
            reduce your Ventry allocation before selling those units elsewhere.
          </P>
        </Sub>
        <Sub title="5.3 You may not use Ventry as a shop window only">
          <P>
            You must not use Ventry to advertise or reserve places while taking payment outside the platform, and you
            must not direct buyers who have found your event on Ventry to pay you by transfer or any other external
            method.
          </P>
        </Sub>
        <Sub title="5.4 Why this matters">
          <P>
            A buyer who pays through Ventry and is turned away because the place was sold to someone else has been
            sold something that did not exist. We treat this as one of the most serious breaches of these Terms.
          </P>
        </Sub>
        <Sub title="5.5 What happens if we find you have done this">
          <P>We will investigate. Where we find that inventory listed on Ventry has also been sold elsewhere:</P>
          <Ul items={[
            'we stop all remaining sales on the event immediately;',
            'every ticket already sold through Ventry remains valid and you must honour it;',
            'we may hold settlement of any funds not yet paid to you;',
            'you may be suspended or permanently removed from Ventry;',
            'we may report the matter to law enforcement.',
          ]} />
          <P>
            We do not take the event down and cancel existing tickets. Buyers who paid in good faith should not lose
            their place because of something you did, so their tickets stand.
          </P>
        </Sub>
        <Sub title="5.6 If a Ventry buyer is turned away">
          <P>
            If any buyer holding a valid Ventry ticket is denied entry, or cannot use the table or space they paid
            for, because it was sold to someone else, you must refund them the full base ticket price. This applies
            whether or not the event otherwise went ahead, and it is not subject to your published refund policy.
          </P>
          <P>
            This is the most serious breach in these Terms. Selling something twice means a buyer paid Ventry for a
            place that did not exist.
          </P>
        </Sub>
      </Section>

      <Section id="buyer-relationship" title="6. Your relationship with buyers">
        <Sub title="6.1 The contract is between you and the buyer">
          <P>
            When a buyer purchases a ticket to your event, the contract for that event is between you and the buyer.
            Ventry is not a party to it. Ventry provides the ticketing platform and collects payment on your behalf
            as your limited collection agent.
          </P>
        </Sub>
        <Sub title="6.2 You are responsible for the event">
          <P>
            You are solely responsible for holding the event, for its quality and safety, for admission, for all
            licences, permits and approvals, for compliance with the law, and for all taxes arising from it.
          </P>
        </Sub>
        <Sub title="6.3 You handle buyer support and refunds">
          <P>
            You are responsible for answering buyer questions, handling complaints, and paying refunds due under
            your refund policy or under these Terms. Ventry does not issue refunds on your behalf and does not fund
            them.
          </P>
        </Sub>
        <Sub title="6.4 Minimum refund standards">
          <P>Whatever refund policy you publish, you must refund buyers in the following situations:</P>
          <Ul items={[
            'the event is cancelled: you must refund the full base ticket price to every buyer on the claim list;',
            'the event is postponed and no valid new date is confirmed within 30 days: the event is treated as cancelled and the same obligation applies;',
            'the venue or date changes within 7 days of the event: this is treated as a cancellation;',
            'an act you billed as Headliner does not appear;',
            'the event does not take place, or takes place in a form so different from what was advertised that a buyer did not receive what they paid for;',
            'a buyer holding a valid Ventry ticket is denied the place they paid for.',
          ]} />
          <P>
            A policy of no refunds on cancellation, or of a partial refund on cancellation, is not available on
            Ventry. If your published policy is narrower than this section, this section applies.
          </P>
        </Sub>
        <Sub title="6.5 No refunds for change of mind">
          <P>
            No event on Ventry offers a refund because a buyer decided not to attend or could not make it. You are
            not required to offer one and you cannot be made to.
          </P>
        </Sub>
        <Sub title="6.6 Private resale between buyers">
          <P>
            Buyers may pass their tickets to other people privately. Ventry takes no part in that and neither do you.
            A QR code admits one person once, so if a buyer sells the same ticket to several people only the first
            to be scanned is admitted. You have no obligation to those others and neither does Ventry.
          </P>
        </Sub>
        <Sub title="6.7 Headliner billing carries an obligation">
          <P>
            Where you bill an act as Headliner and that act does not appear, buyers may claim a refund of the full
            base ticket price. This applies on every event and you cannot opt out of it.
          </P>
          <P>
            The reason is that a headline act is usually why a ticket sold. If that name is the flyer, buyers paid
            for that name. If you do not want the obligation, do not bill anyone as Headliner. Guest Artist, Special
            Guest and Surprise Guest billings do not carry it.
          </P>
          <P>
            Headliner claims must be made by buyers within 24 hours after the event ends. Ventry verifies them with
            you and, where necessary, with the venue. Where Ventry is still holding funds for the event, those funds
            are held while claims are verified.
          </P>
        </Sub>
        <Sub title="6.8 Response times">
          <P>You must acknowledge and respond to refund questions within five working days.</P>
        </Sub>
      </Section>

      <Section id="fees" title="7. Fees">
        <Sub title="7.1 Ventry platform fee">
          <P>
            Ventry charges you a platform fee of 3% of the ticket price on every paid ticket sold. It is deducted at
            settlement. Listing is free and there is no charge for free events.
          </P>
        </Sub>
        <Sub title="7.2 Buyer service fee">
          <P>
            Ventry charges buyers a service fee of 2% of the ticket price, or a flat NGN 3,000 per ticket where the
            ticket price is NGN 150,000 or above. This is paid by the buyer in addition to your ticket price and
            does not reduce what you receive.
          </P>
        </Sub>
        <Sub title="7.3 Payment processing fee">
          <P>
            1.5% of the transaction total, plus NGN 100 on transactions above NGN 2,500, capped at NGN 2,000 per
            transaction and rounded up to the next naira. It is charged to the buyer at checkout and paid to our
            payment processor. It is not retained by Ventry and does not reduce what you receive.
          </P>
        </Sub>
        <Sub title="7.4 Worked example">
          <P>On a ticket you price at NGN 10,000:</P>
          <Table
            head={['Item', 'Amount']}
            rows={[
              ['Your base ticket price', 'NGN 10,000'],
              ['Ventry platform fee, 3%', 'NGN 300'],
              [<strong key="r">You receive</strong>, <strong key="a">NGN 9,700</strong>],
              ['Buyer service fee, paid by the buyer', 'NGN 200'],
              ['Processing fee, paid by the buyer', 'NGN 253'],
              ['Total the buyer pays', 'NGN 10,453'],
            ]}
          />
        </Sub>
        <Sub title="7.5 Fees are not returned">
          <P>
            The Ventry platform fee is earned when the ticket is sold and is not returned to you in any
            circumstances, including where your event is cancelled or postponed, or where you refund your buyers.
            The service Ventry charges for has been provided by that point.
          </P>
          <P>The buyer service fee and the processing fee are not refunded to buyers. Where you refund a buyer, you refund the ticket price.</P>
        </Sub>
        <Sub title="7.6 Changes to fees">
          <P>We may change our fees. The fees in force when your event goes live apply to that event for its whole sales period.</P>
        </Sub>
      </Section>

      <Section id="settlement" title="8. Settlement">
        <Sub title="8.1 How settlement works">
          <P>
            Ventry collects ticket payments on your behalf and settles them to you on a rolling basis. Funds from
            tickets sold on a given day are normally settled to your verified account on the next working day, less
            the Ventry platform fee.
          </P>
        </Sub>
        <Sub title="8.2 What you receive">
          <P>
            You receive 97% of the ticket price on each ticket sold. Your dashboard shows your figures on this basis
            at all times: total tickets sold, funds settled, and funds pending settlement.
          </P>
        </Sub>
        <Sub title="8.3 Public holidays">
          <P>Where a settlement run falls on a weekend or a public holiday in Nigeria, it moves to the next working day.</P>
        </Sub>
        <Sub title="8.4 Where settlement can be made">
          <P>
            Settlement is made only to your verified settlement account. We will not settle to a third party, and we
            will not settle to an account that does not match your verified legal name or registered entity.
          </P>
        </Sub>
        <Sub title="8.5 The verification limit">
          <P>
            Settlement to an unverified organiser stops once a cumulative total of NGN 500,000 has been paid to you,
            and resumes when verification is complete. See section 3.7.
          </P>
        </Sub>
        <Sub title="8.6 Delays outside our control">
          <P>
            Settlement depends on our payment processor and on the banking system. We are not liable for delays
            caused by a payment processor, a bank, or any other third party, or by incorrect account details you
            have given us.
          </P>
        </Sub>
      </Section>

      <Section id="holding-settlement" title="9. Holding settlement and investigations">
        <P>
          Settlement to you is not automatic and unconditional. Ventry may hold funds where it has grounds to
          investigate. This section explains when and why.
        </P>
        <Sub title="9.1 Our right to hold">
          <P>
            Ventry may hold, delay or suspend settlement of any or all funds relating to you or to any of your
            events, including funds already due and not yet paid, where any of the grounds in section 9.2 applies.
            Holding funds is a right, not an obligation, and does not make Ventry responsible for any refund.
          </P>
        </Sub>
        <Sub title="9.2 Grounds for a hold">
          <P>We may hold settlement where:</P>
          <Ul items={[
            'we suspect fraud, dishonesty, or unlawful activity by you or in connection with your event;',
            'we receive complaints from buyers about your event at a volume or of a kind that causes us concern;',
            'we detect unusual purchasing activity on your event, including repeated purchases from the same account, card, device or IP address, or bulk purchases in amounts we consider suspicious;',
            'a chargeback or payment dispute is raised on your event;',
            'we suspect that inventory has been sold outside Ventry in breach of section 5;',
            'you have cancelled or postponed the event;',
            'you have failed to provide verification we have requested;',
            'you are in breach of these Terms, or we are required to hold funds by law or by a competent authority.',
          ]} />
        </Sub>
        <Sub title="9.3 Unusual purchasing activity">
          <P>
            Ventry monitors purchasing patterns. Where our systems identify the kind of activity described above,
            the matter is escalated for review and settlement on that event may be held in whole or in part while it
            is examined. Patterns of this kind can indicate card fraud, ticket touting, or an attempt to move funds
            through the platform, and we investigate them regardless of who is involved.
          </P>
        </Sub>
        <Sub title="9.4 During a hold">
          <P>
            We will tell you that a hold is in place and, so far as we are able, why. We may ask you for information
            and documents, and you must cooperate with our investigation. Your event may remain on sale or may be
            taken down while we investigate.
          </P>
        </Sub>
        <Sub title="9.5 Outcome of a hold">
          <P>
            Where the investigation concludes without a finding against you, held funds are settled to you. Where we
            find fraud, misuse of the platform, or that buyers have paid for something they will not receive, we may
            return the held funds to the buyers they came from, retain funds to cover chargebacks or amounts you owe
            us, terminate your account, and report the matter to law enforcement.
          </P>
        </Sub>
        <Sub title="9.6 Held funds are not a refund guarantee">
          <P>
            Returning held funds to buyers is at our discretion and is only ever possible for money we still hold.
            Buyers have no right to require it and it does not transfer your refund obligations to Ventry.
          </P>
        </Sub>
      </Section>

      <Section id="cancellation" title="10. Cancellation, postponement, changes and the claim list">
        <P>
          Once tickets have been sold you cannot simply edit the date or the venue. Both are treated as a
          postponement, both can be done once, nothing can move inside 7 days of the event, and a second attempt
          closes the event.
        </P>
        <Sub title="10.1 Tell us immediately">
          <P>
            You must notify Ventry immediately, and in any event within 24 hours, if your event is cancelled or
            postponed, or if there is any material change to it, including a change of venue, date, time or lineup.
          </P>
        </Sub>
        <Sub title="10.2 Before any ticket is sold">
          <P>
            While no tickets have been sold you may change the date, venue or time freely. Nothing has been bought
            and the change is an edit to your listing.
          </P>
        </Sub>
        <Sub title="10.3 Once tickets have been sold">
          <P>
            Once a single ticket has been sold, the date and venue are fixed. Changing either is a postponement, not
            an edit, and is subject to the rest of this section.
          </P>
        </Sub>
        <Sub title="10.4 One postponement only">
          <P>
            You may postpone an event once after tickets have gone on sale. A change of venue is treated in exactly
            the same way and counts as your one postponement. If you need to move the event again, you cannot. The
            only option available to you is cancellation.
          </P>
        </Sub>
        <Sub title="10.5 Nothing can move within 7 days of the event">
          <P>
            A postponement or a change of venue inside 7 days of the event date is treated as a cancellation,
            whatever you call it. The event closes, buyers are notified, and the claim window opens.
          </P>
          <P>
            By that point buyers have arranged their day, made travel plans and in some cases paid for other things.
            A move that late is not a reschedule, and we treat it accordingly.
          </P>
        </Sub>
        <Sub title="10.6 Changing the time on the same day">
          <P>
            Moving the start time while keeping the same date is not a postponement, does not use your one
            postponement, and does not open a refund window. Buyers are notified and their tickets remain valid.
          </P>
          <P>The time cannot be changed within 2 days of the event.</P>
        </Sub>
        <Sub title="10.7 The two thirty-day limits on a new date">
          <P>When you postpone, three rules apply to the new date and all must be met:</P>
          <Ul items={[
            'you must confirm the new date within 30 days of the postponement;',
            'the new date must fall within 30 days of the original event date;',
            'the new date must be at least 7 days after the day you confirm it, so that buyers are given reasonable notice.',
          ]} />
          <P>If you cannot satisfy all three, you cannot reschedule. The event is treated as cancelled, buyers are notified, and the claim window opens.</P>
        </Sub>
        <Sub title="10.8 If you confirm nothing">
          <P>
            If 30 days pass from the postponement without a confirmed new date, the event is automatically treated
            as cancelled. You do not have to do anything for this to happen and you cannot stop it once the period
            has run.
          </P>
        </Sub>
        <Sub title="10.9 If you cancel">
          <P>
            You must refund the full base ticket price to every buyer on the claim list, whatever your published
            policy says about anything else. You must pay within the timeframe you published, being 7, 14 or 30
            days, counted from the date Ventry sends you the claim list.
          </P>
        </Sub>
        <Sub title="10.10 Funds Ventry still holds">
          <P>
            Where an event is cancelled and Ventry is still holding funds for it, Ventry refunds the base ticket
            price on those tickets directly to those buyers, automatically and without a claim. Those buyers are
            marked as already paid on the claim list, so you do not pay them again.
          </P>
          <P>Ventry does not return its platform fee on those refunds, and the amount refunded is deducted from anything otherwise due to you.</P>
        </Sub>
        <Sub title="10.11 The claim window">
          <P>
            Buyers do not have your contact details and you do not have theirs. Ventry holds them. So a refund
            starts with a claim from the buyer, and that claim has a deadline.
          </P>
          <P>
            Buyers have 30 days to claim, running from the date Ventry sends the first cancellation notice. Ventry
            emails every affected buyer on the day of the cancellation and again on days 15, 25 and 30 if they have
            not claimed. A claim made after day 30 is not payable and does not go on the list.
          </P>
        </Sub>
        <Sub title="10.12 The claim list">
          <P>
            At the end of the 30 days Ventry sends you one list of everyone who claimed, with the bank details each
            buyer supplied, the amount due to each, and a note of anyone Ventry has already refunded under section
            10.10.
          </P>
          <P>
            We send it as a single list rather than passing claims through as they arrive so that you see your whole
            liability at once rather than paying whoever claimed first and running out, so that every buyer is
            treated the same way, and so that nobody is paid twice.
          </P>
        </Sub>
        <Sub title="10.13 Your deadline runs from the list">
          <P>
            The 7, 14 or 30 days you published starts on the date we send you the claim list, not on the date of the
            cancellation and not on the date any individual buyer claimed.
          </P>
        </Sub>
        <Sub title="10.14 Confirming that you have paid">
          <P>
            When you have settled the list you must notify Ventry with proof of payment. We then confirm to those
            buyers that the refunds have gone out.
          </P>
          <P>
            Buyers are told when the list is sent to you and are told your deadline. If your deadline passes, a
            buyer can raise it with us, and we will require you to show that you paid. Where you cannot, the failure
            is recorded against your account and section 11 applies.
          </P>
        </Sub>
        <Sub title="10.15 The platform fee">
          <P>Ventry does not return its 3% platform fee where an event is cancelled or postponed, or where you refund your buyers.</P>
        </Sub>
        <Sub title="10.16 Ventry does not handle refund money">
          <P>
            Except for funds Ventry still holds under section 10.10, Ventry does not collect refunds from you and
            does not pay them out to buyers on your behalf. Refunds move from you to the buyer directly. Where we
            assist, we assist with the process and never with the funds.
          </P>
        </Sub>
        <Sub title="10.17 Assistance is a courtesy, not an obligation">
          <P>
            If you are struggling to work through a claim list you may ask us for help, and where we are able we
            will help. That help is given at our discretion as a courtesy. It does not transfer your refund
            obligations to Ventry, does not make Ventry liable for any refund, and we may decline or stop at any
            time.
          </P>
        </Sub>
        <Sub title="10.18 Settlement is held">
          <P>Where you cancel or postpone an event, any funds not yet settled to you may be held under section 9.</P>
        </Sub>
      </Section>

      <Section id="standing" title="11. Cancellations, non-payment of refunds, and your standing on Ventry">
        <Sub title="11.1 Why this matters to us">
          <P>
            An organiser who cancels events, or who cancels and does not refund, damages the buyers involved and
            damages the reputation of the platform they sold through. Ventry treats a pattern of this as a serious
            matter.
          </P>
        </Sub>
        <Sub title="11.2 What we take into account">
          <P>We consider, among other things:</P>
          <Ul items={[
            'how many events you have cancelled, and over what period;',
            'the proportion of your events that have been cancelled;',
            'whether you gave a reasonable explanation for a cancellation and whether it is supported by evidence;',
            'whether you refunded your buyers, and how promptly;',
            'the volume and nature of buyer complaints about you;',
            'whether the cancellation followed a pattern we consider consistent with fraud.',
          ]} />
        </Sub>
        <Sub title="11.3 What we may do">
          <P>Where we consider it warranted we may:</P>
          <Ul items={[
            'remove your verification badge;',
            'require additional verification before you list again;',
            'restrict the number or size of events you may list;',
            'change your settlement arrangements, including holding funds until after your events have taken place;',
            'take down your live events;',
            'suspend your account;',
            'permanently remove you from Ventry.',
          ]} />
        </Sub>
        <Sub title="11.4 Repeated cancellation">
          <P>
            Repeated cancellation, cancellation without a reasonable explanation, and cancellation followed by
            failure to refund buyers may each result in permanent removal from Ventry. Where we remove you, we may
            decline to deal with you again under any name, business or entity.
          </P>
        </Sub>
        <Sub title="11.5 Our discretion">
          <P>
            These are measures available to us and we decide which to apply. We are not required to apply them in
            any order, and taking no action on one occasion does not prevent us from acting on another.
          </P>
        </Sub>
      </Section>

      <Section id="prohibited" title="12. Prohibited conduct">
        <Sub title="12.1 What you must not do">
          <P>You must not:</P>
          <Ul items={[
            'create a fake, fictitious or misleading event, or list an event you do not intend or are not able to hold;',
            'sell tickets, tables or places that do not exist or are not available;',
            'sell the same inventory both on Ventry and elsewhere, in breach of section 5;',
            'take payment outside Ventry for places advertised on Ventry;',
            'buy tickets to your own event, or arrange for others to do so, in order to inflate recorded sales, trigger settlement, or create the appearance of demand;',
            'use stolen, cloned or unauthorised payment instruments, or knowingly accept purchases made with them;',
            'use Ventry for money laundering, the financing of terrorism, tax evasion, or to move or disguise the origin of funds;',
            'use Ventry for any event or activity that is unlawful under Nigerian law;',
            'upload content that is infringing, defamatory, obscene, hateful or otherwise unlawful;',
            'impersonate another person, business or brand, or misrepresent your association with anyone;',
            'interfere with the platform, or use bots, scrapers or automated tools without our written permission;',
            'behave in a way that is likely to damage the reputation of Ventry.',
          ]} />
        </Sub>
        <Sub title="12.2 Financial crime">
          <P>
            Ventry does not tolerate the use of the platform to launder money or to finance unlawful activity. We
            monitor transactions, we investigate patterns that concern us, and we report where we are required or
            entitled to do so. Cooperation with an investigation is a condition of holding an organiser account.
          </P>
        </Sub>
        <Sub title="12.3 Consequences">
          <P>
            A breach of this section may result in immediate suspension, holding of all your funds, takedown of your
            events, permanent removal, referral to law enforcement, and a claim against you for any loss we suffer.
          </P>
        </Sub>
      </Section>

      <Section id="chargebacks" title="13. Chargebacks">
        <Sub title="13.1 What a chargeback is">
          <P>
            A chargeback is a payment dispute raised by a buyer with their bank or card issuer. Where it succeeds,
            the amount is taken back from Ventry, together with any fee the processor charges, regardless of
            anything in these Terms.
          </P>
        </Sub>
        <Sub title="13.2 You are liable">
          <P>
            You are liable to Ventry for the full amount of any chargeback on your events, together with any
            associated fees. This applies whether or not the funds have already been settled to you and whether or
            not you accept that the chargeback was justified.
          </P>
        </Sub>
        <Sub title="13.3 How we recover">
          <P>
            We may deduct the amount from any funds we hold for you, from settlements due on any of your events
            including unrelated ones, or invoice you for it. Where we invoice you, payment is due within 14 days.
          </P>
        </Sub>
        <Sub title="13.4 If you cannot pay within 14 days">
          <P>
            If you are unable to pay within 14 days you must write to us before the deadline explaining why and
            stating when you will pay. We will consider a reasonable proposal and may agree a schedule.
          </P>
          <P>
            If you neither pay nor contact us within 14 days, we will treat the amount as a debt owed to Ventry and
            pursue recovery, which may include legal proceedings. Silence is the thing that takes this to a lawyer.
            A message explaining the position usually does not.
          </P>
        </Sub>
        <Sub title="13.5 Your cooperation">
          <P>
            You must give us any information and evidence we reasonably request to defend a chargeback, promptly and
            at your own cost.
          </P>
        </Sub>
        <Sub title="13.6 Reducing chargebacks">
          <P>
            Answering buyers promptly and paying refunds that are due is the most effective way to avoid
            chargebacks. A high chargeback rate is a ground for holding settlement, changing your settlement
            arrangements, or removing you from the platform.
          </P>
        </Sub>
      </Section>

      <Section id="indemnity" title="14. Indemnity">
        <Sub title="14.1 Your indemnity">
          <P>
            You agree to indemnify Ventry, and to hold Ventry harmless, against all claims, demands, losses,
            damages, liabilities, costs and expenses, including reasonable legal costs, arising out of or in
            connection with:
          </P>
          <Ul items={[
            'your event, including its cancellation, postponement, alteration or non-performance;',
            'any refund you owe a buyer and do not pay;',
            'any claim by a buyer, venue, performer, authority or third party in connection with your event;',
            'any chargeback on your events;',
            'any breach by you of these Terms or of any applicable law;',
            "any content you upload, including any claim that it infringes a third party's rights;",
            'your handling of attendee personal data.',
          ]} />
        </Sub>
        <Sub title="14.2 Survival">
          <P>This indemnity continues after your account is closed or these Terms come to an end.</P>
        </Sub>
      </Section>

      <Section id="suspension" title="15. Suspension, takedown and removal">
        <Sub title="15.1 When we may act">
          <P>
            We may take down an event, suspend your account, restrict your access, or permanently remove you from
            Ventry where:
          </P>
          <Ul items={[
            'you breach these Terms;',
            'you fail to provide verification we have requested;',
            'we suspect fraud or other unlawful activity;',
            'we receive buyer complaints that cause us serious concern;',
            'we are required to act by law or by a competent authority;',
            'your conduct presents a risk to buyers, to other organisers, or to Ventry.',
          ]} />
        </Sub>
        <Sub title="15.2 Notice">
          <P>
            We will notify you by email when we take any of these steps, and will tell you the reason so far as we
            are able. Where the risk is serious we may act first and notify you immediately afterwards. We may
            withhold the reason where telling you would prejudice an investigation or where we are prevented from
            telling you by law or by a competent authority.
          </P>
        </Sub>
        <Sub title="15.3 Effect on buyers">
          <P>
            Where we take down an event that has sold tickets, we will notify the buyers. Taking down an event does
            not release you from your obligations to those buyers, including the obligation to refund them.
          </P>
        </Sub>
      </Section>

      <Section id="disclosure" title="16. Information we may disclose">
        <Sub title="16.1 To authorities">
          <P>
            We may disclose information we hold about you, your account, your events and your transactions to law
            enforcement agencies, regulators, courts and other competent authorities where we are required to do so
            by law, where we receive a lawful request or court order, or where we consider disclosure necessary in
            connection with suspected fraud or other unlawful activity. You consent to this disclosure.
          </P>
        </Sub>
        <Sub title="16.2 To buyers">
          <P>
            We do not release your personal identity documents or verification data to buyers. Buyers are given the
            refund contact address you have provided and the display name shown on your event page.
          </P>
        </Sub>
        <Sub title="16.3 To our providers">
          <P>We share information with our payment processor, verification providers and other service providers to the extent needed to operate the platform.</P>
        </Sub>
      </Section>

      <Section id="data-protection" title="17. Data protection">
        <Sub title="17.1 Our processing">
          <P>Ventry processes personal data in accordance with the Nigeria Data Protection Act 2023 and our Privacy Policy.</P>
        </Sub>
        <Sub title="17.2 Your obligations">
          <P>
            Where you receive attendee information through Ventry, including names, email addresses and check-in
            data, you are an independent controller of that data. You must handle it in accordance with the Nigeria
            Data Protection Act 2023, use it only in connection with the event it relates to, keep it secure, and
            not sell it or pass it to anyone else without a lawful basis. You are responsible for your own
            compliance and you indemnify us for any failure of it.
          </P>
        </Sub>
      </Section>

      <Section id="content-ip" title="18. Content and intellectual property">
        <Sub title="18.1 Your content">
          <P>
            You keep ownership of the content you upload. You grant Ventry a non-exclusive, royalty-free licence to
            host, display, reproduce and promote it in connection with operating and promoting the platform and your
            event.
          </P>
        </Sub>
        <Sub title="18.2 Your warranty">
          <P>
            You warrant that you own or are licensed to use everything you upload and that it does not infringe
            anyone&rsquo;s rights. We may remove infringing content without notice.
          </P>
        </Sub>
        <Sub title="18.3 Our platform">
          <P>
            Ventry owns the platform, its software, design, trademarks and branding. Nothing in these Terms gives
            you any right in them beyond using the platform as permitted.
          </P>
        </Sub>
      </Section>

      <Section id="liability" title="19. Our liability to you">
        <Sub title="19.1 What we are responsible for">
          <P>
            This section limits what Ventry can be held liable for, so it starts with what we do accept. We are
            responsible for providing the ticketing service: issuing tickets, collecting payment on your behalf,
            settling it to you on the next working day, running the door and check-in system, and operating the
            notification and claim processes in these Terms. Where we fail at any of that, we put it right.
          </P>
          <P>
            We work to keep the platform available, secure and accurate, and we invest in doing so. We do not
            warrant that it will be uninterrupted or error-free at all times, because no platform can honestly
            promise that.
          </P>
        </Sub>
        <Sub title="19.2 What we are not liable for">
          <P>
            Ventry is not liable to you for lost profit, lost sales, lost business or opportunity, reputational
            damage, wasted expenditure, or any indirect or consequential loss. Nor are we liable for the acts or
            omissions of a payment processor, bank, venue, performer, buyer or other third party.
          </P>
        </Sub>
        <Sub title="19.3 Limit on the amount">
          <P>
            Where Ventry is liable to you, there is a ceiling on the amount. In connection with any single event, our
            liability is limited to the platform fee Ventry earned on that event. Across any 12-month period, our
            total liability is limited to the platform fees Ventry earned from you in that period.
          </P>
          <P>
            In practical terms, on an event where we earned NGN 105,000 in platform fees, that figure is the ceiling
            on any claim arising from that event. The limit ties what we can be asked to pay to what we were
            actually paid, which is what allows us to charge 3% rather than pricing in unlimited exposure to the
            commercial outcome of events we do not run.
          </P>
        </Sub>
        <Sub title="19.4 What we do not exclude">
          <P>Nothing in these Terms excludes liability that cannot be excluded under Nigerian law, including liability for fraud.</P>
        </Sub>
      </Section>

      <Section id="outside-control" title="20. Events outside our control">
        <P>
          Ventry is not liable for any failure or delay caused by events outside our reasonable control, including
          internet or power failure, failure of a payment processor or other third-party provider, cyberattack,
          government action, civil unrest, natural disaster, epidemic or pandemic.
        </P>
      </Section>

      <Section id="term-termination" title="21. Term, termination and survival">
        <Sub title="21.1 Closing your account">
          <P>
            You may close your organiser account at any time, provided you have no live events, no tickets sold for
            an event that has not yet taken place, no unsettled funds, no unpaid refund claims and nothing owed to
            Ventry.
          </P>
          <P>
            Where any of those is outstanding, the account cannot be closed until it is discharged. We do not
            release an organiser from their obligations by letting them close the account, and we do not hand a
            buyer the job of chasing a closed account.
          </P>
        </Sub>
        <Sub title="21.2 Our termination">
          <P>We may terminate your account under section 15.</P>
        </Sub>
        <Sub title="21.3 What survives">
          <P>
            Termination does not affect your obligations to buyers who have already bought tickets, your obligation
            to refund them, your liability for chargebacks, the indemnity in section 14, or any other provision
            intended to survive.
          </P>
          <P>
            Where we terminate your account while you have unmet refund obligations, we continue to hold you to them
            and continue to pursue them. Removal from Ventry is a consequence, not a release.
          </P>
        </Sub>
      </Section>

      <Section id="terms-changes" title="22. Changes to these terms">
        <P>
          We may change these Terms. The current version is published on ventrybooking.com with its version number
          and effective date. The version in force when your event goes live governs that event. Continued use of
          Ventry after a change takes effect is acceptance of the changed Terms for future events.
        </P>
      </Section>

      <Section id="governing-law" title="23. Governing law and arbitration">
        <Sub title="23.1 Governing law">
          <P>These Terms are governed by the laws of the Federal Republic of Nigeria.</P>
        </Sub>
        <Sub title="23.2 Resolution first">
          <P>
            The parties will first attempt to resolve any dispute in good faith. Raise it with us at{' '}
            <a href={`mailto:${ADMIN_EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{ADMIN_EMAIL}</a>.
          </P>
        </Sub>
        <Sub title="23.3 Arbitration">
          <P>
            If a dispute is not resolved within 30 days of being raised, it shall be referred to arbitration in
            Abuja, Federal Capital Territory, in accordance with the Arbitration and Mediation Act 2023. The seat of
            the arbitration is Abuja, the language is English, and the arbitrator&rsquo;s decision is final and
            binding. Each party bears its own costs unless the arbitrator directs otherwise.
          </P>
        </Sub>
        <Sub title="23.4 Interim relief">
          <P>
            Nothing in this section prevents either party from applying to a court for urgent interim relief, or
            prevents Ventry from bringing proceedings to recover money you owe it.
          </P>
        </Sub>
      </Section>

      <Section id="contact" title="24. Contact">
        <P>Ventry Solutions, RC BN9586934, Abuja, Federal Capital Territory, Nigeria.</P>
        <P>
          Organiser support and account matters:{' '}
          <a href={`mailto:${ADMIN_EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{ADMIN_EMAIL}</a>
        </P>
        <P>
          General support:{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>
        </P>
        <P>ventrybooking.com</P>
      </Section>

      <div
        className="pt-8 border-t flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
      >
        <span>&copy; {new Date().getFullYear()} Ventry. All rights reserved.</span>
        <div className="flex gap-4">
          <Link href="/terms/buyers" style={{ color: 'var(--color-purple-light)' }}>Buyer Terms</Link>
          <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>
        </div>
      </div>
    </LegalLayout>
  );
}
