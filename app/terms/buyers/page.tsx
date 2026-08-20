import Link from 'next/link';
import { LegalLayout, Section, Sub, P, Ul, Table } from '@/components/legal/LegalDoc';

const VERSION   = '1.1';
const EFFECTIVE = '19 August 2026';
const EMAIL     = 'support@ventrybooking.com';

const toc = [
  { id: 'about',          label: '1. About Ventry' },
  { id: 'definitions',    label: '2. Definitions' },
  { id: 'account',        label: '3. Your account and details' },
  { id: 'what-you-pay',   label: '4. What you pay' },
  { id: 'escrow',         label: '5. Escrow protection' },
  { id: 'refunds',        label: '6. Refunds' },
  { id: 'changes',        label: '7. Changes to an event' },
  { id: 'your-ticket',    label: '8. Your ticket' },
  { id: 'lineups',        label: '9. Lineups, headliners & guests' },
  { id: 'fraud',          label: '10. Fraudulent events' },
  { id: 'liability',      label: '11. Limits on Ventry’s responsibility' },
  { id: 'communications', label: '12. Communications' },
  { id: 'terms-changes',  label: '13. Changes to these terms' },
  { id: 'contact',        label: '14. Governing law and contact' },
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
          These terms govern your use of Ventry as a ticket buyer. By purchasing a ticket through ventrybooking.com you agree to them.
          Please read section 4 and section 6 carefully, as they set out exactly what you pay and when you are entitled to a refund.
        </>
      }
    >
      <Section id="about" title="1. About Ventry">
        <P>
          Ventry is a secure event ticketing platform operated by Ventry Solutions, registered in Nigeria under RC BN9586934,
          with its registered address at Plot 1, VinMartin Ilo Avenue, Mamman Vatsa Writers Village Maitama Extension,
          Abuja 900271, FCT, Nigeria.
        </P>
        <P>
          Ventry provides the ticketing infrastructure. Ventry is not the organiser, promoter, or host of any event listed on
          the platform. The organiser is responsible for the event itself, including its content, its guest lineup, its venue,
          and admission on the day.
        </P>
      </Section>

      <Section id="definitions" title="2. Definitions">
        <Ul items={[
          <><strong>&quot;Buyer&quot;, &quot;you&quot;</strong> means any person who purchases or holds a ticket through Ventry.</>,
          <><strong>&quot;Organiser&quot;</strong> means the person or entity that lists an event on Ventry and is responsible for delivering it.</>,
          <><strong>&quot;Event&quot;</strong> means an occasion listed on Ventry for which tickets are sold, whether physical or online.</>,
          <><strong>&quot;Escrow&quot;</strong> means the holding of ticket funds by Ventry so that they are not released to the organiser before the event takes place.</>,
          <><strong>&quot;Ticket price&quot;</strong> means the amount set by the organiser for a ticket, excluding the service fee and the processing fee.</>,
        ]} />
      </Section>

      <Section id="account" title="3. Your account and your details">
        <P>
          You must provide an accurate name, email address, and phone number at checkout. Your ticket and all event communications
          are sent to the details you provide. Ventry is not responsible for tickets that cannot be delivered because of an
          incorrect email address or phone number.
        </P>
        <P>
          If you lose access to your ticket, you can retrieve it at any time at{' '}
          <Link href="/retrieve" style={{ color: 'var(--color-purple-light)' }}>www.ventrybooking.com/retrieve</Link> using the
          details you purchased with.
        </P>
      </Section>

      <Section id="what-you-pay" title="4. What you pay">
        <P>
          Every purchase is made up of three components. All three are shown to you at checkout before you pay, and the total
          you see at checkout is the exact amount debited from your account.
        </P>

        <Sub id="ticket-price" title="4.1 Ticket price">
          <P>Set entirely by the organiser. Ventry does not set, control, or adjust ticket prices.</P>
        </Sub>

        <Sub id="service-fee" title="4.2 Ventry service fee">
          <P>
            A service fee of <strong>2% of the ticket price applies to every ticket, capped at ₦3,000 per ticket</strong>.
            The cap is reached at a ticket price of ₦150,000, so any ticket priced at ₦150,000 or above carries a
            service fee of exactly ₦3,000.
          </P>
          <P>The cap applies per ticket, not per transaction. If you buy four tickets, the fee is calculated and capped on each ticket individually.</P>
          <Table
            head={['Ticket price', 'Service fee']}
            rows={[
              ['₦8,500', '₦170'],
              ['₦50,000', '₦1,000'],
              ['₦150,000', '₦3,000'],
              ['₦500,000', '₦3,000'],
            ]}
          />
        </Sub>

        <Sub id="processing-fee" title="4.3 Processing fee">
          <P>
            A processing fee is charged by our third party payment processor to move your money securely. This fee is not
            retained by Ventry. It is charged at 1.5% of the transaction, with an additional flat charge of ₦100 on
            transactions of ₦2,500 and above, and is capped at ₦2,000 per transaction.
          </P>
          <P>
            <strong>The total displayed at checkout is the total you pay.</strong> Ventry calculates the processing fee into
            the displayed total, so the amount you are charged never exceeds the amount you agreed to.
          </P>
        </Sub>

        <Sub id="worked-example" title="4.4 Worked example">
          <P>A single ticket priced at ₦16,500 appears at checkout as follows.</P>
          <Table
            head={['Line item', 'Amount']}
            rows={[
              ['Ticket price', '₦16,500.00'],
              ['Ventry service fee (2%)', '₦330.00'],
              ['Processing fee', '₦357.82'],
              [<strong key="t">Total charged</strong>, <strong key="a">₦17,187.82</strong>],
            ]}
          />
        </Sub>
      </Section>

      <Section id="escrow" title="5. Escrow protection">
        <P>
          Funds from ticket sales are held in escrow by Ventry and are not released to the organiser until the event has taken
          place. This is the mechanism that allows Ventry to refund buyers when an organiser cancels, and it is the core
          protection Ventry provides.
        </P>
        <P>
          Escrow protects you against the organiser taking your money and not delivering the event. It does not guarantee the
          quality, content, or enjoyment of an event that does take place.
        </P>
      </Section>

      <Section id="refunds" title="6. Refunds">
        <P>
          Refunds are governed by the{' '}
          <Link href="/refund-policy" style={{ color: 'var(--color-purple-light)' }}>Ventry Refund Policy</Link>, which forms
          part of these terms. In summary:
        </P>
        <Ul items={[
          'You are refunded the ticket price if the organiser cancels the event.',
          'You are refunded the ticket price if Ventry flags the event as fraudulent.',
          'You may request a refund following certain changes to an event, as set out in section 7.',
          'You may request a refund where a headliner at a concert or performance is removed or does not perform, as set out in section 9.',
          'You are not refunded if you do not attend, or if you change your mind after purchase.',
        ]} />
        <P>
          In every case, refunds cover the <strong>ticket price only</strong>. The Ventry service fee and the processing fee
          are non-refundable under all circumstances, including where the organiser is at fault. These fees cover work already
          performed and money already moved at the point of purchase.
        </P>
        <P>Refunds are processed within 3 to 5 business days to your original payment method.</P>
      </Section>

      <Section id="changes" title="7. Changes to an event">
        <P>
          Organisers sometimes need to move the date or the venue of an event. Ventry treats these changes differently
          depending on how significant they are.
        </P>

        <Sub id="minor-changes" title="7.1 Minor changes">
          <P>
            A change of date, or a change of venue within the same city, made more than 7 days before the scheduled event
            date, is treated as a change and not a cancellation. Your ticket remains valid for the event at its new date or
            venue.
          </P>
          <P>
            When such a change is made, Ventry sends a notification to every ticket holder setting out what has changed.
            If the new arrangement does not work for you, you may request a refund of the ticket price.
          </P>
          <P>
            <strong>The refund request window is open for 48 hours from the time the change notification is sent.</strong>{' '}
            After 48 hours the window closes and your ticket stands.
          </P>
          <P>
            To request a refund within the window, contact Ventry at{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>. Once your refund is
            approved, your ticket is immediately invalidated and will not admit you to the event.
          </P>
        </Sub>

        <Sub id="changes-cancellation" title="7.2 Changes treated as cancellation">
          <P>
            The following are treated as cancellations, and the full refund entitlement in section 6 applies automatically
            without you needing to request anything:
          </P>
          <Ul items={[
            'Any change of city. If the event moves to a different city from the one advertised at the time you purchased, it is a cancellation.',
            'Any change of location made within 7 days of the scheduled event date.',
          ]} />
          <P>
            These rules exist because a buyer who bought a ticket for an event in Enugu cannot reasonably be expected to
            travel to Lagos, and because a venue change made days before an event does not leave enough time to make new
            arrangements.
          </P>
        </Sub>
      </Section>

      <Section id="your-ticket" title="8. Your ticket">
        <Ul items={[
          'Each ticket carries a unique QR code and admits the number of people stated on it, once.',
          'You may buy tickets of different types in a single order. Each ticket is issued and priced separately, and the service fee is calculated on each ticket individually.',
          'Scanning and admission are carried out by the organiser and the organiser’s staff at the venue. Ventry provides the QR infrastructure but does not staff or control entry.',
          'Do not share images of your QR code publicly. A ticket that has already been scanned cannot be scanned again, and Ventry is not responsible if someone else uses a code you have shared.',
          'Tickets may not be resold at a markup or offered for commercial resale through any third party.',
          'The organiser may refuse admission in line with its own venue rules, including age restrictions, dress code, and conduct. Refusal of admission on these grounds is not a refundable event.',
        ]} />
      </Section>

      <Section id="lineups" title="9. Lineups, headliners, and guests">
        <P>
          Organisers may list artists, performers, or guests expected at an event, and may add to that lineup at any time
          while the event is upcoming. Ventry requires organisers to list only people they have actually confirmed.
        </P>
        <P>
          Whether the non-appearance of a listed name entitles you to a refund depends on what the ticket was sold as.
          Ventry distinguishes between an event where a performance is the product and an event where an artist is a
          feature of the night.
        </P>
        <Table
          head={['Listed as', 'Does not appear']}
          rows={[
            ['Headliner, at a concert or performance', 'Refund available on request'],
            ['Guest Artist, at a concert or performance', 'No refund'],
            ['Special Guest, at a party or social event', 'No refund'],
            ['Surprise Guest', 'No refund, no identity was promised'],
          ]}
        />
        <P>
          A headliner is the billed act a concert ticket is sold on. Only a headliner at an event advertised as a concert
          or performance carries a refund entitlement.
        </P>
        <P>
          At a party, festival, or social event there is no headliner. Everyone listed is a Special Guest. If you bought a
          ticket to a party and an artist did not perform, the party still took place and no refund arises. Ventry’s
          protection covers the event you paid for, and at a party the event is the party.
        </P>

        <Sub id="headliner-removed" title="9.1 A headliner is removed before the event">
          <P>
            If an organiser removes a headliner from the lineup before the event day, the event is not cancelled and
            continues to sell. Ventry notifies every ticket holder, and a refund request window opens for 48 hours from
            that notification. If you request a refund within the window you are refunded the ticket price and your ticket
            is invalidated immediately.
          </P>
        </Sub>

        <Sub id="headliner-no-show" title="9.2 A headliner does not perform on the night">
          <P>
            If a headliner at a concert or performance does not perform, you may request a refund of the ticket price{' '}
            <strong>within 24 hours of the event ending</strong>. Refunds in this case are not automatic. You must request
            one, because only you can say whether what you attended was what you paid for.
          </P>
          <P>
            The window is 24 hours because the organiser’s payout begins processing at that point. A claim made after
            the window has closed cannot be paid, because the funds have already left escrow.
          </P>
          <P>
            Send claims to <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a> with the
            event name and your ticket reference. Where claims are received, Ventry freezes the organiser’s payout and
            verifies them. Verification takes up to 72 hours from the close of the window, after which upheld claims are
            refunded from escrow and you are notified of the outcome either way.
          </P>
        </Sub>

        <Sub id="event-type-decision" title="9.3 How Ventry decides what an event is">
          <P>
            Ventry determines whether an event is a concert or performance by how it was actually marketed, not by the
            category the organiser selected. Where the flyer, title, and description are built around a named artist, the
            event is treated as a performance regardless of how it was labelled.
          </P>
          <P>Where an organiser lists a surprise guest, no identity is promised and none should be inferred.</P>
        </Sub>
      </Section>

      <Section id="fraud" title="10. Fraudulent events">
        <P>
          Ventry requires organisers to provide proof of their venue booking before an event can be verified. If Ventry
          determines that an event is fraudulent, the event is removed, the organiser’s payout is withheld, and all
          buyers are refunded the ticket price from escrow.
        </P>
        <P>
          If you believe an event is not genuine, report it to{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>.
        </P>
      </Section>

      <Section id="liability" title="11. Limits on Ventry’s responsibility">
        <P>
          Ventry is responsible for the ticketing service: taking your payment securely, delivering your ticket, holding
          funds in escrow, and processing refunds in line with this policy.
        </P>
        <P>
          Ventry is not responsible for the running of an event, the conduct of an organiser or its staff, the condition or
          safety of a venue, the quality of an event, or anything that happens to you at an event. Ventry’s total
          liability to you in connection with any ticket is limited to the amount you paid for that ticket.
        </P>
        <P>Nothing in these terms excludes any liability that cannot be excluded under Nigerian law.</P>
      </Section>

      <Section id="communications" title="12. Communications">
        <Sub id="transactional" title="12.1 Transactional messages">
          <P>
            By purchasing a ticket you agree to receive messages from Ventry relating to your purchase, including your
            ticket confirmation, event reminders, and notifications of any change to the event. These are not marketing
            messages and cannot be opted out of while you hold a valid ticket.
          </P>
        </Sub>
        <Sub id="marketing" title="12.2 Optional marketing">
          <P>At checkout you are offered two separate and optional choices. Ticking neither has no effect on your ticket.</P>
          <Table
            head={['You may choose to receive', 'What that means']}
            rows={[
              ['Updates from the organiser', 'News of that organiser’s future events. Written by them, reviewed and sent by Ventry. The organiser never receives your email address.'],
              ['Updates from Ventry', 'Events coming up across the platform, new features, and platform news, sent by Ventry.'],
            ]}
          />
          <P>
            These are independent. Agreeing to hear from an organiser does not subscribe you to Ventry, and agreeing to
            hear from Ventry does not subscribe you to any organiser. Each carries its own unsubscribe link and you may
            withdraw either at any time without affecting the other.
          </P>
          <P>
            Mail from an organiser arrives in that organiser’s name but is sent by Ventry, and every such message is
            reviewed by Ventry before it is sent. Replies go to{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>, not to the organiser.
          </P>
          <P>
            Your email address is never given to an organiser. Organisers see only the name used to purchase. Where an
            organiser mails their audience, Ventry reviews the message and sends it on their behalf.
          </P>
        </Sub>
      </Section>

      <Section id="terms-changes" title="13. Changes to these terms">
        <P>
          Ventry may update these terms. The version in force at the time of your purchase governs that purchase. Material
          changes will be published on ventrybooking.com with an updated effective date.
        </P>
      </Section>

      <Section id="contact" title="14. Governing law and contact">
        <P>
          These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Nigeria have exclusive
          jurisdiction over any dispute arising from them.
        </P>
        <Table
          head={['Contact', 'Detail']}
          rows={[
            ['Support', <a key="s" href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>],
            ['Platform', 'www.ventrybooking.com'],
            ['Ticket retrieval', 'www.ventrybooking.com/retrieve'],
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
          <Link href="/terms/organisers" style={{ color: 'var(--color-purple-light)' }}>Organiser Terms</Link>
          <Link href="/refund-policy" style={{ color: 'var(--color-purple-light)' }}>Refund Policy</Link>
          <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>
        </div>
      </div>
    </LegalLayout>
  );
}
