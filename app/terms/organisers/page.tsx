import Link from 'next/link';
import { LegalLayout, Section, Sub, P, Ul, Table } from '@/components/legal/LegalDoc';

const VERSION   = '1.1';
const EFFECTIVE = '19 August 2026';
const EMAIL     = 'support@ventrybooking.com';
const ADMIN_EMAIL = 'admin@ventrybooking.com';

const toc = [
  { id: 'about',          label: '1. About Ventry' },
  { id: 'eligibility',    label: '2. Eligibility & your profile' },
  { id: 'listing',        label: '3. Listing an event' },
  { id: 'fees',           label: '4. Fees' },
  { id: 'escrow',         label: '5. Escrow and payouts' },
  { id: 'changing',       label: '6. Changing or cancelling your event' },
  { id: 'audience',       label: '7. Audience' },
  { id: 'check-in',       label: '8. Check-in and admission' },
  { id: 'withheld',       label: '9. Withheld payouts' },
  { id: 'content',        label: '10. Your content' },
  { id: 'data',           label: '11. Data protection' },
  { id: 'termination',    label: '12. Termination' },
  { id: 'liability',      label: '13. Limits on Ventry’s responsibility' },
  { id: 'terms-changes',  label: '14. Changes to these terms' },
  { id: 'contact',        label: '15. Governing law and contact' },
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
          These terms govern your use of Ventry as an event organiser. By listing an event on ventrybooking.com you agree
          to them. Sections 4, 5, 6 and 9 set out how you are paid and the circumstances in which a payout may be withheld.
          Read those closely.
        </>
      }
    >
      <Section id="about" title="1. About Ventry and your relationship with us">
        <P>
          Ventry is a secure event ticketing platform operated by Ventry Solutions, registered in Nigeria under RC BN9586934,
          with its registered address at Plot 1, VinMartin Ilo Avenue, Mamman Vatsa Writers Village Maitama Extension,
          Abuja 900271, FCT, Nigeria.
        </P>
        <P>
          Ventry provides ticketing infrastructure to you. Ventry is not a partner, promoter, co-host, or agent of your
          event. You remain solely responsible for delivering the event you advertise, for the venue, for the safety and
          conduct of your event, and for compliance with all applicable Nigerian law, including any licences or permits
          your event requires.
        </P>
      </Section>

      <Section id="eligibility" title="2. Eligibility and your organiser profile">
        <Ul items={[
          'You must be at least 18 years old and legally capable of entering into a contract.',
          'You must provide accurate identity details and a valid Nigerian bank account in a name you control or are authorised to receive funds into.',
          'You choose a display name, which is how buyers see you across Ventry. It may be your personal name or a brand name. It is shown on your organiser page, on your events, and as the sender name on mail sent to your audience.',
          'Your profile also has a handle, which forms your organiser page address. Handles are unique, allocated on a first come basis, and may not impersonate another person, brand, or organisation.',
          'Your handle may be changed once every three months. This limit exists because your handle is the address printed on flyers and shared in messages, and changing it frequently would break links your buyers already hold.',
          'Ventry may reclaim a handle that impersonates a third party or that is used in bad faith.',
          'You must complete identity verification before receiving a payout. Documents you upload are held confidentially and are visible to Ventry administrators only.',
        ]} />
      </Section>

      <Section id="listing" title="3. Listing an event">
        <P>
          You are responsible for the accuracy of everything on your event page: the title, description, date, time, venue,
          ticket types, prices, and quantities.
        </P>

        <Sub id="venue-proof" title="3.1 Venue proof">
          <P>
            Before an event can be verified on Ventry you must upload <strong>proof of your venue booking</strong>: a
            receipt, a signed venue agreement, a booking confirmation, or equivalent documentation naming you and the
            venue for the date advertised.
          </P>
          <P>
            A photograph of a venue is not proof of a booking. Photographs of venues the organiser has not booked are the
            most common form of ticketing fraud in this market, and Ventry does not accept them as evidence.
          </P>
          <P>
            <strong>Venue proof is what earns the Ventry Verified Event badge on your event page.</strong> Events without
            it may still list, but they will not carry the badge, and buyers are considerably less likely to purchase
            from an unverified listing.
          </P>
          <P>
            Venue documentation you upload is held confidentially by Ventry, is not shown to buyers, and is used only to
            verify the event and to investigate disputes.
          </P>
        </Sub>

        <Sub id="event-type" title="3.2 Event type">
          <P>
            You select an event type when creating your event. This determines how your lineup works and what refund
            exposure you carry.
          </P>
          <Table
            head={['Event type', 'Lineup slots available']}
            rows={[
              ['Concert or Performance', 'Headliner and Guest Artist'],
              ['Party, Social, Festival, Conference', 'Special Guest only'],
            ]}
          />
          <P>
            Ventry determines whether an event is a concert or performance <strong>by how it was actually marketed, not
            by the category you selected</strong>. Where your flyer, title, and description are built around a named
            artist, your event is treated as a performance regardless of the label applied.
          </P>
        </Sub>

        <Sub id="lineup" title="3.3 Lineup">
          <P>
            You may add to your lineup at the point of creating the event and at any time afterwards while the event is
            still upcoming, so that you can announce names as you confirm them.
          </P>
          <P>
            You may only list a named person whose appearance you have actually confirmed. Listing a name and image you
            have not secured is a misrepresentation to buyers and is grounds for Ventry withholding your payout in full.
          </P>
          <P>If you have someone you do not wish to announce, list them as a surprise guest. No name or image is shown and none is promised.</P>
          <Table
            head={['Slot', 'Meaning', 'Your refund exposure']}
            rows={[
              ['Headliner', 'The billed act the concert ticket is sold on', 'Yes'],
              ['Guest Artist', 'An additional artist at a concert', 'None'],
              ['Special Guest', 'A guest at a party or social event', 'None'],
              ['Surprise Guest', 'Unnamed, no identity promised', 'None'],
            ]}
          />
          <P>
            <strong>You control your own exposure.</strong> Only a Headliner at a concert carries a refund liability. If
            you are not certain an artist will perform, list them as a Guest Artist and you carry none.
          </P>
        </Sub>

        <Sub id="event-qr" title="3.4 Event QR codes">
          <P>
            You may generate a QR code for your event link from your dashboard. The code carries the Ventry mark at its
            centre and may be used freely on your flyers, posters, screens, and any other material promoting that event.
            You may not alter the code, remove the Ventry mark, or use it to direct people anywhere other than your
            Ventry event page.
          </P>
        </Sub>

        <Sub id="headliner-removed" title="3.5 Headliner removed before the event">
          <P>
            If you remove a headliner from a concert lineup before the event day, your event is not cancelled and
            continues to sell. Ventry notifies every ticket holder, and a 48-hour refund request window opens from that
            notification, on the same basis as a date change under section 6.1. Refunds issued are deducted from your
            payout. Removing a headliner is not by itself grounds for withholding your payout.
          </P>
        </Sub>

        <Sub id="headliner-no-show" title="3.6 Headliner does not perform">
          <P>
            If a headliner listed on a concert or performance does not perform on the night, buyers may request a refund
            of the ticket price within 24 hours of the event ending. Refunds are not automatic; each claim is verified by
            Ventry before payment, and refunds paid are deducted from your payout.
          </P>
          <P>If no claim is received within that window, your payout begins processing as normal at 24 hours and is unaffected.</P>
          <P>
            If a claim is received, your payout is <strong>frozen at the 24-hour mark</strong> and Ventry verifies the
            claim. Verification takes up to 72 hours from the close of the claim window. At the end of that period the
            payout is either released to you, or the claimed tickets are refunded from escrow and the balance released.
          </P>
          <P>You will be contacted during verification and given the opportunity to respond with evidence. Responding promptly shortens the hold.</P>
          <P>The non-appearance of a Guest Artist, a Special Guest, or a surprise guest does not entitle any buyer to a refund.</P>
        </Sub>

        <Sub id="prohibited" title="3.7 Prohibited events">
          <P>
            You may not list events that are illegal under Nigerian law, that promote violence or hatred, that involve
            the sale of controlled substances or firearms, that are fraudulent or fictitious, or that you do not have the
            authority to run.
          </P>
        </Sub>
      </Section>

      <Section id="fees" title="4. Fees">
        <Sub id="platform-fee" title="4.1 Your platform fee">
          <P>
            Ventry charges a platform fee of <strong>3% of gross ticket sales</strong>, deducted from your payout after
            the event has taken place. There is no listing fee, no subscription, and no charge for creating an event. You
            pay only when you get paid.
          </P>
        </Sub>
        <Sub id="buyer-fees" title="4.2 Buyer fees">
          <P>
            Separately, buyers pay a service fee of 2% per ticket, capped at ₦3,000 per ticket, plus a processing fee
            charged by our payment processor. These are paid by the buyer on top of your ticket price and are not
            deducted from your revenue.
          </P>
          <P>Both buyer fees are non-refundable in all circumstances, including where you cancel or change your event.</P>
        </Sub>
        <Sub id="fees-example" title="4.3 Worked example">
          <P>An event selling 100 tickets at ₦10,000 each settles as follows.</P>
          <Table
            head={['Line item', 'Amount']}
            rows={[
              ['Gross ticket sales (100 × ₦10,000)', '₦1,000,000'],
              ['Ventry platform fee (3%)', '− ₦30,000'],
              [<strong key="p">Your payout</strong>, <strong key="a">₦970,000</strong>],
            ]}
          />
        </Sub>
      </Section>

      <Section id="escrow" title="5. Escrow and payouts">
        <Ul items={[
          'All funds from ticket sales are held in escrow by Ventry until your event has taken place. They are not available to you before the event day.',
          'Payouts begin processing 24 hours after the event ends, and funds are received within a further 24 hours, net of the platform fee and net of any refunds already issued. In practice you are paid within 24 to 48 hours of your event.',
          'Where a headliner claim is raised on your event under section 3.6, your payout is frozen at the 24-hour mark and released or adjusted once verification is complete, within a further 72 hours.',
          'Payouts are made only to a verified Nigerian bank account matching your organiser details.',
          'Ventry may delay a payout while an active dispute, fraud report, or chargeback relating to your event is being investigated.',
        ]} />
        <P>
          Escrow exists to protect buyers, and it is the reason buyers are willing to purchase from an organiser they have
          not dealt with before. It is the platform’s central promise and it is not waivable.
        </P>
      </Section>

      <Section id="changing" title="6. Changing or cancelling your event">
        <P>
          Ventry recognises that dates and venues sometimes move for legitimate reasons. The following rules balance that
          reality against the buyer’s right not to be left holding a ticket for an event they can no longer attend.
        </P>

        <Sub id="minor-changes" title="6.1 Minor changes">
          <P>
            A change of date, or a change of venue within the same city, made more than 7 days before the scheduled event
            date, is treated as a change and not a cancellation. Your payout is not withheld and your event continues to
            sell.
          </P>
          <P>When you make such a change:</P>
          <Ul items={[
            'Ventry notifies every ticket holder of the change automatically.',
            'A refund request window opens for 48 hours from the time that notification is sent.',
            'Any buyer who requests a refund within that window is refunded the ticket price, and their ticket is invalidated immediately and will not admit them.',
            'After 48 hours the window closes. Remaining tickets stand and are valid for the event as changed.',
            'Refunds issued under this section are deducted from your final payout.',
          ]} />
          <P><strong>Refunds triggered by a change you made come out of your revenue, not Ventry’s.</strong> Move a date or a venue only when you have to.</P>
        </Sub>

        <Sub id="changes-cancellation" title="6.2 Changes treated as cancellation">
          <P>The following are treated as a cancellation of the event, and every ticket holder is refunded the ticket price in full from escrow:</P>
          <Ul items={[
            'A change of city. Moving the event to a city other than the one advertised at the time of sale is a cancellation, regardless of how much notice is given.',
            'Any change of location made within 7 days of the scheduled event date.',
          ]} />
          <P>Where this happens you receive no payout for the tickets refunded, and the buyer fees paid on those tickets are not returned to buyers. You may relist the event as a new listing.</P>
        </Sub>

        <Sub id="cancellation" title="6.3 Cancellation">
          <P>
            If you cancel your event outright, every ticket holder is refunded the ticket price from escrow and you
            receive no payout in respect of those tickets. Repeated cancellations may result in removal from the
            platform.
          </P>
        </Sub>
      </Section>

      <Section id="audience" title="7. Audience">
        <P>
          Audience is how you reach the people who have bought your tickets. It is not a self-serve mailing tool, and you
          are never given your buyers’ contact details.
        </P>

        <Sub id="audience-how" title="7.1 How it works">
          <Ul items={[
            'You write your message in your dashboard, in whatever form you choose, and may include images.',
            'You submit it to Ventry.',
            'Ventry reviews it. Nothing is sent without review.',
            <>Ventry sends it in your display name, with replies directed to <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>.</>,
            'Ventry confirms to you by email once it has been sent.',
          ]} />
        </Sub>

        <Sub id="audience-recipients" title="7.2 Who receives it">
          <P>
            Your message reaches buyers who agreed at checkout to hear from you, and anyone who has subscribed to your
            organiser page. It does not reach anyone who has not agreed, and it does not reach Ventry’s wider user base.
          </P>
        </Sub>

        <Sub id="audience-visibility" title="7.3 What you see">
          <P>
            You see the name a buyer used to purchase, and nothing further. Ventry does not provide buyer email addresses
            or phone numbers to organisers under any circumstance, and there is no export or download of buyer contact
            data. This protects buyers, and it is a condition of Ventry’s compliance with the Nigeria Data Protection Act.
          </P>
        </Sub>

        <Sub id="audience-restrictions" title="7.4 What you may not send">
          <Ul items={[
            'Content unrelated to your own events.',
            'Promotion of a third party, or any message sent on behalf of someone else.',
            'Anything unlawful, misleading, or likely to bring the platform into disrepute.',
          ]} />
          <P>Ventry may decline to send a message, and will tell you why. Repeated misuse may result in Audience being withdrawn from your account.</P>
        </Sub>

        <Sub id="audience-cost" title="7.5 Cost">
          <P>
            Audience is currently provided at no charge. Ventry may introduce a charge for it in future, whether as a
            subscription or per message sent. You will be given notice before any charge applies, and you are never
            obliged to continue using it.
          </P>
        </Sub>
      </Section>

      <Section id="check-in" title="8. Check-in and admission">
        <P>
          Ventry provides the QR ticketing and scanning infrastructure. Scanning guests in at your event is carried out
          by you and your own staff, using any phone. Ventry does not supply personnel or hardware, and does not manage
          entry at your venue.
        </P>
        <P>You are responsible for admission decisions, crowd management, security, and compliance with venue capacity limits.</P>
      </Section>

      <Section id="withheld" title="9. Withheld payouts">
        <P>Ventry may withhold all or part of your payout, and where appropriate refund buyers from escrow, in any of the following circumstances:</P>
        <Ul items={[
          'The event did not take place and you did not cancel it.',
          'You listed a named artist or guest whose appearance you had not confirmed.',
          'You marketed an event around a named artist while labelling it as a party in order to avoid headliner refund exposure.',
          'You provided false, altered, or fabricated venue documentation.',
          'You did not hold the venue you advertised.',
          'The event materially differed from what was advertised in a way that misled buyers.',
          'Ventry has flagged the event as fraudulent.',
          'There is an unresolved dispute, chargeback, or law enforcement enquiry relating to the event.',
        ]} />
        <P>
          A change of date, a change of venue within the same city made more than 7 days out, or the removal of a
          headliner you had genuinely booked, is <strong>not</strong> grounds for withholding a payout. Those are handled
          under sections 6.1 and 3.5, and only the refunds actually issued are deducted.
        </P>
        <P>
          Where Ventry withholds a payout you will be notified with the reason, and you may respond with evidence.
          Ventry’s determination following that response is final in respect of the platform, and does not affect any
          legal right either party may have.
        </P>
      </Section>

      <Section id="content" title="10. Your content and Ventry’s use of it">
        <P>
          You retain ownership of your event flyer, logo, guest images, and event copy. You grant Ventry a non-exclusive
          licence to display, reproduce, and adapt that material for the purpose of operating, promoting, and marketing
          the platform and your event on it, including in share previews, discovery listings, and emails to buyers.
        </P>
        <P>
          You confirm that you hold the rights to everything you upload, including the right to use the name and image
          of any guest you list. You are responsible for any third party claim arising from material you upload.
        </P>
      </Section>

      <Section id="data" title="11. Data protection">
        <P>
          Ventry is the controller of buyer contact data. Organisers are not given buyer email addresses or phone
          numbers, and there is no mechanism to export them. You see the name a buyer used to purchase, for the purpose
          of admitting them to your event and managing your attendee list.
        </P>
        <P>
          Attendee names shown to you may be used only for running the event that buyer purchased a ticket for. You may
          not sell them, transfer them to a third party, or use them for unrelated purposes. You remain responsible for
          complying with the Nigeria Data Protection Act in respect of any personal data you hold.
        </P>
        <P>Where you wish to contact your buyers, use Audience under section 7. That is the only route by which an organiser may reach Ventry buyers.</P>
      </Section>

      <Section id="termination" title="12. Termination">
        <P>
          You may stop using Ventry at any time, subject to completing or cancelling any event with tickets already sold.
          Ventry may suspend or terminate your access where you breach these terms, where fraud is suspected, or where
          your conduct exposes buyers or Ventry to risk. Termination does not affect Ventry’s obligation to refund buyers
          from escrow where refunds are due.
        </P>
      </Section>

      <Section id="liability" title="13. Limits on Ventry’s responsibility">
        <P>
          Ventry is responsible for providing the ticketing platform with reasonable skill and care. Ventry is not
          responsible for the commercial success of your event, for ticket sales volumes, for attendance, or for losses
          arising from an event you chose to run.
        </P>
        <P>
          Ventry’s total liability to you in connection with any event is limited to the platform fees Ventry earned on
          that event. Nothing in these terms excludes any liability that cannot be excluded under Nigerian law.
        </P>
      </Section>

      <Section id="terms-changes" title="14. Changes to these terms">
        <P>
          Ventry may update these terms. Material changes will be published on ventrybooking.com with an updated
          effective date and, where the change affects fees or payouts, notified to active organisers by email. Events
          already live at the time of a change continue under the version in force when they were listed.
        </P>
      </Section>

      <Section id="contact" title="15. Governing law and contact">
        <P>
          These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Nigeria have
          exclusive jurisdiction over any dispute arising from them.
        </P>
        <Table
          head={['Contact', 'Detail']}
          rows={[
            ['Organiser support', <a key="s" href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>],
            ['Administration', <a key="a" href={`mailto:${ADMIN_EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{ADMIN_EMAIL}</a>],
            ['Platform', 'www.ventrybooking.com'],
            ['Registered entity', 'Ventry Solutions, RC BN9586934'],
          ]}
        />
      </Section>

      <div
        className="pt-8 border-t flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
      >
        <span>&copy; {new Date().getFullYear()} Ventry. All rights reserved.</span>
        <div className="flex gap-4">
          <Link href="/terms/buyers" style={{ color: 'var(--color-purple-light)' }}>Buyer Terms</Link>
          <Link href="/refund-policy" style={{ color: 'var(--color-purple-light)' }}>Refund Policy</Link>
          <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>
        </div>
      </div>
    </LegalLayout>
  );
}
