import Link from 'next/link';
import { LegalLayout, Section, Sub, P, Ul, Table } from '@/components/legal/LegalDoc';

const VERSION   = '2.1';
const EFFECTIVE = '19 August 2026';
const EMAIL     = 'support@ventrybooking.com';

const toc = [
  { id: 'short-version',  label: '1. The short version' },
  { id: 'what-refunded',  label: '2. What is refunded' },
  { id: 'escrow',         label: '3. Escrow' },
  { id: 'automatic',      label: '4. Automatic refunds' },
  { id: 'request-window', label: '5. Refunds on request: 48 hours' },
  { id: 'headliners',     label: '6. Headliners and guests' },
  { id: 'no-refund',      label: '7. When there is no refund' },
  { id: 'how-to-request', label: '8. How to request a refund' },
  { id: 'timing',         label: '9. How long refunds take' },
  { id: 'reporting',      label: '10. Reporting a problem' },
  { id: 'contact',        label: '11. Contact' },
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
          This policy explains when a Ventry ticket is refunded, what portion of your payment is returned, and how to
          request a refund. It applies to every ticket sold on ventrybooking.com and forms part of the{' '}
          <Link href="/terms/buyers" style={{ color: 'var(--color-purple-light)', textDecoration: 'underline' }}>Ventry Buyer Terms of Use</Link> and the{' '}
          <Link href="/terms/organisers" style={{ color: 'var(--color-purple-light)', textDecoration: 'underline' }}>Ventry Organiser Terms of Use</Link>.
        </>
      }
    >
      <Section id="short-version" title="1. The short version">
        <Table
          head={['Situation', 'Outcome']}
          rows={[
            ['Organiser cancels the event', 'Ticket price refunded automatically'],
            ['Ventry flags the event as fraudulent', 'Ticket price refunded automatically'],
            ['Event moves to another city', 'Ticket price refunded automatically'],
            ['Location changes within 7 days of the event', 'Ticket price refunded automatically'],
            ['Date or venue changes, more than 7 days out, same city', 'Refund on request within 48 hours'],
            ['Concert headliner removed before the event', 'Refund on request within 48 hours'],
            ['Concert headliner does not perform', 'Refund on request within 24 hours'],
            ['A guest artist or special guest does not appear', 'No refund'],
            ['An artist does not perform at a party or social event', 'No refund'],
            ['You do not attend', 'No refund'],
            ['You change your mind', 'No refund'],
            ['You are refused entry under venue rules', 'No refund'],
          ]}
        />
      </Section>

      <Section id="what-refunded" title="2. What is refunded">
        <P>A refund covers the <strong>ticket price only</strong>.</P>
        <P>
          The Ventry service fee and the processing fee are non-refundable under all circumstances, including where the
          organiser cancels, changes, or misrepresents the event. These fees cover the cost of securing the transaction
          and moving the money at the point of purchase, which has already been incurred by the time a refund arises.
        </P>
        <Table
          head={['Component', 'Refundable']}
          rows={[
            ['Ticket price', 'Yes'],
            ['Ventry service fee (2%, capped at ₦3,000 per ticket)', 'No'],
            ['Processing fee', 'No'],
          ]}
        />
        <P>Example: a ₦16,500 ticket bought for ₦17,187.82 in total is refunded at ₦16,500.</P>

        <Sub id="multi-ticket-orders" title="2.1 Orders containing more than one ticket">
          <P>
            Where an order contains several tickets, refunds are calculated per ticket. If a refund applies to the whole
            event, every ticket in the order is refunded at its own ticket price. Where you request a refund under a
            change window and hold tickets of more than one type, you may request a refund of some or all of them; any
            ticket refunded is invalidated immediately, and any ticket you keep remains valid.
          </P>
        </Sub>
      </Section>

      <Section id="escrow" title="3. Escrow: why refunds are possible">
        <P>
          Ventry holds ticket funds in escrow until an event has taken place. The organiser cannot access the money
          before then. This is what makes a refund guarantee meaningful rather than a promise, and it is why Ventry can
          refund buyers even when an organiser will not.
        </P>
      </Section>

      <Section id="automatic" title="4. Automatic refunds">
        <P>In the following cases you do not need to do anything. Ventry refunds every ticket holder from escrow and notifies you by email.</P>

        <Sub id="organiser-cancels" title="4.1 The organiser cancels">
          <P>Where an organiser cancels an event, all tickets are refunded at the ticket price.</P>
        </Sub>
        <Sub id="fraud-flag" title="4.2 Ventry flags the event as fraudulent">
          <P>
            Ventry requires organisers to provide proof of their venue booking. Where Ventry determines that an event is
            fraudulent, whether through false venue documentation, a venue the organiser never held, or a fabricated
            listing, the event is removed, the organiser’s payout is withheld in full, and all buyers are refunded.
          </P>
        </Sub>
        <Sub id="city-change" title="4.3 The event moves to another city">
          <P>
            A change of city is treated as a cancellation, regardless of how much notice is given. A buyer who purchased
            for an event in one city cannot reasonably be expected to travel to another.
          </P>
        </Sub>
        <Sub id="late-location-change" title="4.4 The location changes within 7 days">
          <P>
            Any change of location made within 7 days of the scheduled event date is treated as a cancellation, because
            it leaves buyers without adequate time to make new arrangements.
          </P>
        </Sub>
      </Section>

      <Section id="request-window" title="5. Refunds on request: the 48-hour window">
        <P>
          Where an organiser changes the date, or changes the venue within the same city, more than 7 days before the
          event, the event is not cancelled. Your ticket remains valid for the new date or venue.
        </P>
        <P>
          Ventry notifies every ticket holder of the change. If the new arrangement does not work for you, you may
          request a refund of the ticket price.
        </P>
        <P>
          <strong>The refund request window is open for 48 hours from the time the change notification is sent.</strong>{' '}
          After 48 hours it closes and your ticket stands.
        </P>
        <P>
          The window is time limited so that organisers know their final numbers with enough notice to cater, staff, and
          secure a venue. It is not a general cooling-off period and it opens only when a change has actually been made.
        </P>
        <P>Once a refund under this section is approved, your ticket is invalidated immediately. It will not scan and will not admit you to the event.</P>
      </Section>

      <Section id="headliners" title="6. Headliners and guests">
        <P>
          Whether a missing artist entitles you to a refund depends on what the ticket was sold as. Ventry distinguishes
          between an event where a performance is the product and an event where an artist is a feature of the night.
        </P>
        <Table
          head={['Listed as', 'Where', 'Does not appear']}
          rows={[
            ['Headliner', 'Concert or performance', 'Refund on request'],
            ['Guest Artist', 'Concert or performance', 'No refund'],
            ['Special Guest', 'Party, social, festival', 'No refund'],
            ['Surprise Guest', 'Any event', 'No refund'],
          ]}
        />
        <P>
          A headliner is the billed act a concert ticket is sold on. If you bought a ticket to a concert because a
          particular artist was headlining and that artist does not perform, you did not receive what you paid for.
        </P>
        <P>
          A party is different. If you bought a ticket to a party where an artist was expected to show up and they did
          not, the party still took place. That is the event you paid for, and no refund arises.
        </P>

        <Sub id="headliner-removed" title="6.1 Headliner removed before the event">
          <P>
            The event is not cancelled and continues. Ventry notifies every ticket holder, and a refund request window
            opens for 48 hours from that notification. Request within the window and the ticket price is refunded and
            your ticket invalidated.
          </P>
        </Sub>

        <Sub id="headliner-no-show" title="6.2 Headliner does not perform on the night">
          <P>
            Request a refund of the ticket price <strong>within 24 hours of the event ending</strong>, at{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>, with the event name
            and your ticket reference.
          </P>
          <P><strong>These refunds are on request, never automatic. Only you can say whether what you attended was what you paid for.</strong></P>
          <P>
            The window is 24 hours because the organiser’s payout begins processing at that point. Once funds have left
            escrow they cannot be recovered, so a claim made after the window closes cannot be paid.
          </P>
          <P>
            Where claims are received, the organiser’s payout is frozen and Ventry verifies what happened. Verification
            takes up to 72 hours from the close of the claim window. Upheld claims are refunded from escrow and every
            claimant is notified of the outcome either way.
          </P>
          <Table
            head={['Time after the event', 'What happens']}
            rows={[
              ['0 to 24 hours', 'Claim window open'],
              ['24 hours', 'Window closes; payout processing begins if no claim'],
              ['24 to 48 hours', 'Organiser receives payout'],
              ['24 hours, if a claim is filed', 'Payout frozen, verification begins'],
              ['Up to 96 hours', 'Verification concludes; refund or release'],
            ]}
          />
        </Sub>

        <Sub id="event-type-decision" title="6.3 How Ventry decides what an event is">
          <P>
            Ventry determines whether an event is a concert or performance by how it was actually marketed, not by the
            category the organiser selected. Where a flyer, title, and description are built around a named artist, the
            event is treated as a performance regardless of its label.
          </P>
        </Sub>
      </Section>

      <Section id="no-refund" title="7. When there is no refund">
        <Ul items={[
          'You did not attend the event. A ticket is a reserved place, and that place was held for you.',
          'You changed your mind after purchase.',
          'You bought the wrong ticket type or the wrong quantity. Contact support before the event and Ventry will try to help, but this is at the organiser’s discretion.',
          'You were refused entry under the organiser’s venue rules, including age restrictions, dress code, intoxication, or conduct.',
          'A guest artist, special guest, or surprise guest did not appear. Only a headliner at a concert carries a refund entitlement. See section 6.',
          'The event went ahead but did not meet your expectations. Ventry guarantees that the event happens and that your money is protected until it does. It does not guarantee enjoyment.',
          'You bought your ticket from a third party rather than through Ventry.',
        ]} />
      </Section>

      <Section id="how-to-request" title="8. How to request a refund">
        <Ul items={[
          'Email support@ventrybooking.com from the address you used to purchase.',
          <>Include the event name, the name on the ticket, and your ticket reference. If you cannot find your ticket, retrieve it first at{' '}
            <Link href="/retrieve" style={{ color: 'var(--color-purple-light)' }}>www.ventrybooking.com/retrieve</Link>.</>,
          'State briefly why you are requesting the refund.',
        ]} />
        <P>
          Ventry acknowledges refund requests and confirms the outcome by email. Where a request falls under the 48-hour
          window in section 5 or 6.1, or the 24-hour window in section 6.2, it must be received before that window
          closes.
        </P>
      </Section>

      <Section id="timing" title="9. How long refunds take">
        <P>
          Approved refunds are processed within 3 to 5 business days to the original payment method. Your bank may take
          a further short period to post the funds to your account. Ventry cannot refund to a different account or
          payment method from the one used to purchase.
        </P>
      </Section>

      <Section id="reporting" title="10. Reporting a problem">
        <P>
          If you believe an event is fraudulent, that a venue was never booked, or that a guest lineup was
          misrepresented, report it to{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>. Reports are
          investigated, and organisers found to have misrepresented an event have their payouts withheld and buyers
          refunded from escrow.
        </P>
      </Section>

      <Section id="contact" title="11. Contact">
        <Table
          head={['Contact', 'Detail']}
          rows={[
            ['Refunds and support', <a key="s" href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>],
            ['Ticket retrieval', 'www.ventrybooking.com/retrieve'],
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
          <Link href="/terms/organisers" style={{ color: 'var(--color-purple-light)' }}>Organiser Terms</Link>
          <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>
        </div>
      </div>
    </LegalLayout>
  );
}
