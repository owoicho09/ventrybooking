import Link from 'next/link';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';

const LAST_UPDATED   = '31 May 2026';
const EFFECTIVE      = '31 May 2026';
const EMAIL          = 'support@ventrybooking.com';
const DOMAIN         = 'ventrybooking.com';
const SERVICE_FEE    = '₦100';
const PLATFORM_FEE   = '2.5%';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-24">
      <h2
        className="text-xl font-bold"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        {children}
      </div>
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{title}</p>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5 pl-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-purple)' }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const toc = [
  { id: 'definitions',          label: '1. Definitions' },
  { id: 'eligibility',          label: '2. Eligibility & Registration' },
  { id: 'buyer-terms',          label: '3. Buyer Terms' },
  { id: 'organizer-terms',      label: '4. Organizer Terms' },
  { id: 'escrow',               label: '5. Escrow & Payment Policy' },
  { id: 'refunds',              label: '6. Refunds & Cancellations' },
  { id: 'qr-tickets',           label: '7. QR Tickets & Entry' },
  { id: 'prohibited',           label: '8. Prohibited Activities' },
  { id: 'platform-content',     label: '9. Platform Content' },
  { id: 'liability',            label: '10. Limitation of Liability' },
  { id: 'indemnification',      label: '11. Indemnification' },
  { id: 'termination',          label: '12. Account Termination' },
  { id: 'dispute-resolution',   label: '13. Dispute Resolution' },
  { id: 'governing-law',        label: '14. Governing Law' },
  { id: 'changes',              label: '15. Changes to Terms' },
  { id: 'contact',              label: '16. Contact Us' },
];

export default function TermsPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />

      {/* Header */}
      <div
        className="border-b pt-24 pb-12 px-6"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-purple-light)' }}>
            Legal
          </p>
          <h1
            className="text-4xl sm:text-5xl font-extrabold mb-4"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
          >
            Terms of Service
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Last updated: <strong style={{ color: 'var(--color-text)' }}>{LAST_UPDATED}</strong>
            &ensp;·&ensp;Effective: <strong style={{ color: 'var(--color-text)' }}>{EFFECTIVE}</strong>
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex flex-col lg:flex-row gap-12">

          {/* Table of contents */}
          <aside className="lg:w-56 flex-shrink-0">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-dim)' }}>
                Contents
              </p>
              <nav className="flex flex-col gap-2">
                {toc.map(({ id, label }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="text-xs leading-snug hover:underline"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <article className="flex-1 flex flex-col gap-12">

            {/* Intro */}
            <div className="rounded-xl border p-5 text-sm leading-relaxed"
              style={{ backgroundColor: 'var(--color-purple-dim)', borderColor: '#7c3aed30', color: 'var(--color-purple-light)' }}>
              Please read these Terms of Service carefully before using <strong>{DOMAIN}</strong>.
              By accessing or using the Ventry platform — whether as a ticket buyer or an event organizer —
              you agree to be bound by these Terms. If you do not agree, do not use the platform.
            </div>

            {/* 1 */}
            <Section id="definitions" title="1. Definitions">
              <Ul items={[
                <><strong>&quot;Ventry&quot; / &quot;we&quot; / &quot;us&quot; / &quot;our&quot;</strong> refers to the Ventry platform operated at {DOMAIN}.</>,
                <><strong>&quot;Platform&quot;</strong> means the Ventry website, APIs, and any related services.</>,
                <><strong>&quot;Buyer&quot;</strong> means any user who purchases a ticket through the Platform.</>,
                <><strong>&quot;Organizer&quot;</strong> means any user who has completed KYC verification and lists events for sale on the Platform.</>,
                <><strong>&quot;Event&quot;</strong> means any concert, party, conference, festival, or gathering listed for sale on the Platform.</>,
                <><strong>&quot;Ticket&quot;</strong> means a digitally issued, QR-coded proof of entry to an Event.</>,
                <><strong>&quot;Escrow&quot;</strong> means the holding of Buyer funds by Ventry until the conditions for release to the Organizer are met.</>,
                <><strong>&quot;KYC&quot;</strong> means Know Your Customer — the identity verification process required of all Organizers.</>,
                <><strong>&quot;Service Fee&quot;</strong> means the non-refundable {SERVICE_FEE} flat fee charged to Buyers on each ticket purchase.</>,
                <><strong>&quot;Platform Fee&quot;</strong> means the {PLATFORM_FEE} fee deducted from the Organizer&apos;s gross ticket revenue before payout.</>,
              ]} />
            </Section>

            {/* 2 */}
            <Section id="eligibility" title="2. Eligibility & Registration">
              <Sub title="2.1 Age Requirement">
                <P>
                  You must be at least 18 years of age to register an account or purchase tickets on Ventry.
                  By using the Platform you represent and warrant that you are 18 or older.
                </P>
              </Sub>
              <Sub title="2.2 Account Accuracy">
                <P>
                  You agree to provide accurate, current, and complete information when creating an account
                  and to update this information promptly if it changes. Providing false information, including
                  false KYC documents, is grounds for immediate account termination and may be reported to
                  relevant authorities.
                </P>
              </Sub>
              <Sub title="2.3 Account Security">
                <P>
                  You are responsible for maintaining the confidentiality of your account credentials.
                  You are responsible for all activity that occurs under your account. Notify us immediately
                  at <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a> if
                  you suspect unauthorised access to your account.
                </P>
              </Sub>
              <Sub title="2.4 One Account Per Person">
                <P>
                  Each individual or business entity may maintain only one organizer account. Creating multiple
                  accounts to circumvent platform restrictions, suspensions, or KYC requirements is prohibited.
                </P>
              </Sub>
            </Section>

            {/* 3 */}
            <Section id="buyer-terms" title="3. Buyer Terms">
              <Sub title="3.1 Ticket Purchase">
                <Ul items={[
                  'All ticket sales are processed through Paystack. By completing a purchase you agree to Paystack\'s terms of service.',
                  'A purchase is complete only when payment is confirmed by Paystack and a QR ticket is issued to your email address.',
                  'Prices are displayed in Nigerian Naira (NGN). The price you see at checkout is the total price including the non-refundable Service Fee.',
                  'Tickets are issued per transaction. A maximum of 10 tickets of any single tier may be purchased per transaction.',
                  'Ventry does not guarantee event quality, safety, or the actions of event organizers. We facilitate the transaction and hold funds in escrow on your behalf.',
                ]} />
              </Sub>
              <Sub title="3.2 Service Fee">
                <P>
                  A flat, non-refundable Service Fee of <strong>{SERVICE_FEE}</strong> is added to every ticket
                  transaction. This fee covers the cost of payment processing, QR ticket generation, escrow
                  management, and buyer protection services. The Service Fee is retained by Ventry even in the
                  event of a refund.
                </P>
              </Sub>
              <Sub title="3.3 Ticket Delivery">
                <P>
                  Your QR ticket will be delivered to the email address you provide at checkout. Ensure your email
                  address is correct before completing payment. Ventry is not responsible for tickets delivered
                  to an incorrectly entered email address. If you do not receive your ticket, you may retrieve it
                  at <a href={`https://${DOMAIN}/retrieve`} style={{ color: 'var(--color-purple-light)' }}>{DOMAIN}/retrieve</a> using
                  your email address and Ticket ID.
                </P>
              </Sub>
              <Sub title="3.4 Resale Prohibition">
                <P>
                  Tickets purchased on Ventry are for personal use only. Reselling, transferring, or auctioning
                  tickets above face value (&quot;ticket touting&quot;) is strictly prohibited and may result in
                  ticket invalidation without refund.
                </P>
              </Sub>
              <Sub title="3.5 Buyer Representations">
                <P>By purchasing a ticket you confirm that:</P>
                <Ul items={[
                  'You are purchasing the ticket for lawful personal use.',
                  'You have not used fraudulent payment methods.',
                  'You understand that refund eligibility is governed by Section 6 of these Terms.',
                  'You will comply with the Organizer\'s event rules and terms of admission.',
                ]} />
              </Sub>
            </Section>

            {/* 4 */}
            <Section id="organizer-terms" title="4. Organizer Terms">
              <Sub title="4.1 KYC Requirement">
                <P>
                  All event organizers must complete Ventry&apos;s five-step KYC verification process before
                  creating or publishing any event. The KYC process requires:
                </P>
                <Ul items={[
                  'A valid government-issued photo ID (National ID, Driver\'s Licence, International Passport, or Voter\'s Card).',
                  'A clear selfie holding your photo ID.',
                  'A verified phone number.',
                  'Links to active social media profiles.',
                  'Venue proof documentation demonstrating access to the stated event venue.',
                ]} />
                <P>
                  Submission of false, forged, or misleading KYC documents is a serious violation of these Terms
                  and may constitute a criminal offence under Nigerian law. Ventry reserves the right to reject
                  any KYC application and is not obligated to provide reasons.
                </P>
              </Sub>
              <Sub title="4.2 Platform Fee">
                <P>
                  Ventry charges a Platform Fee of <strong>{PLATFORM_FEE}</strong> on the gross ticket revenue
                  of each event (excluding the Buyer Service Fee). This fee is deducted automatically before
                  payout. For example, if your event generates ₦100,000 in ticket sales, your net payout will
                  be ₦97,500.
                </P>
              </Sub>
              <Sub title="4.3 Payout Conditions">
                <Ul items={[
                  'Funds are held in escrow until after the event date passes and Ventry admin confirms the event occurred.',
                  'Payouts are initiated by Ventry admin after event confirmation. Processing typically takes 3–7 business days.',
                  'Organizers must have a valid Nigerian bank account on file with correct account details before a payout can be released.',
                  'Ventry reserves the right to withhold payouts pending resolution of open complaints or disputes related to an event.',
                  'If an event is cancelled by the organizer, no payout is made and all buyer funds are refunded in full (see Section 6).',
                ]} />
              </Sub>
              <Sub title="4.4 Event Listing Obligations">
                <P>As an Organizer you agree that each event listing will:</P>
                <Ul items={[
                  'Be accurate and truthful in all details, including event name, date, time, venue, and ticket pricing.',
                  'Not infringe any third-party intellectual property rights (music licences, branding, etc.).',
                  'Comply with all applicable Nigerian laws, including those relating to public gatherings, noise ordinances, and venue capacity limits.',
                  'Not promote illegal activities, hate speech, violence, or sexually explicit content.',
                  'Include accurate ticket tier pricing. Organizers may not change ticket prices after sales have begun for a given tier.',
                ]} />
              </Sub>
              <Sub title="4.5 Event Cancellation by Organizer">
                <P>
                  If an Organizer cancels an event for any reason, Ventry will automatically refund all
                  ticket buyers in full (excluding the non-refundable Buyer Service Fee). The Organizer will
                  receive no payout. Organizers who repeatedly cancel events may have their account suspended
                  or terminated. Ventry reserves the right to recover any costs incurred in processing
                  refunds from the Organizer.
                </P>
              </Sub>
              <Sub title="4.6 Organizer Representations">
                <P>By creating events on Ventry, the Organizer represents and warrants that:</P>
                <Ul items={[
                  'They have the legal right and authority to host the event at the stated venue.',
                  'All artists, performers, and acts listed have confirmed their participation.',
                  'The event will take place as advertised unless cancelled due to genuine force majeure circumstances.',
                  'They will honour all ticket purchases and grant entry to holders of valid, unscanned QR tickets.',
                  'They will not use Ventry to collect payment for events they do not intend to hold.',
                ]} />
              </Sub>
            </Section>

            {/* 5 */}
            <Section id="escrow" title="5. Escrow & Payment Policy">
              <P>
                Ventry operates an escrow model designed to protect buyers from fraudulent or cancelled events.
                This section explains exactly how funds flow through the platform.
              </P>
              <Ul items={[
                <><strong>Collection:</strong> when a Buyer purchases a ticket, their payment is processed by Paystack and the funds are credited to Ventry&apos;s Paystack balance, held in escrow on behalf of the Organizer.</>,
                <><strong>Holding period:</strong> funds remain in escrow until the event date passes and Ventry admin confirms the event took place without significant complaint.</>,
                <><strong>Release:</strong> once an event is confirmed, Ventry initiates a Paystack transfer to the Organizer&apos;s registered bank account, less the {PLATFORM_FEE} Platform Fee.</>,
                <><strong>Withholding:</strong> Ventry may withhold or delay payout if there are open refund complaints, suspected fraud, or a dispute regarding whether the event occurred as advertised.</>,
                <><strong>Refund priority:</strong> in the event of a confirmed cancellation or upheld fraud complaint, buyer refunds take precedence over organizer payout. Ventry will process all eligible refunds before releasing any remaining funds to the Organizer.</>,
              ]} />
              <P>
                Ventry does not earn interest on escrowed funds and does not use escrowed funds for any purpose
                other than their intended disbursement to organizers or refund to buyers.
              </P>
            </Section>

            {/* 6 */}
            <Section id="refunds" title="6. Refunds & Cancellations">
              <Sub title="6.1 Eligibility for a Full Refund">
                <P>Buyers are entitled to a full refund of the ticket price (excluding the non-refundable Service Fee) in the following circumstances:</P>
                <Ul items={[
                  'The event is cancelled by the Organizer.',
                  'Ventry admin determines that the event did not take place as advertised (e.g. venue changed without notice, event was significantly materially different from the listing).',
                  'A fraud complaint submitted by the Buyer is upheld by Ventry admin.',
                  'The Organizer is found to have misrepresented a material fact about the event prior to ticket purchase.',
                ]} />
              </Sub>
              <Sub title="6.2 No Refund Circumstances">
                <P>Refunds will not be issued in the following circumstances:</P>
                <Ul items={[
                  'The Buyer changes their mind after purchase (&quot;buyer&apos;s remorse&quot;).',
                  'The Buyer is unable to attend for personal reasons.',
                  'The Buyer was denied entry for reasons within their control (e.g. age verification, dress code, or intoxication).',
                  'The Buyer claims a QR code was not received but the email address provided was incorrect.',
                  'The event occurred as advertised and the Buyer did not attend.',
                ]} />
              </Sub>
              <Sub title="6.3 Service Fee">
                <P>
                  The <strong>{SERVICE_FEE}</strong> Service Fee is non-refundable in all circumstances,
                  including cancellations and upheld fraud complaints. This fee is the cost of the payment
                  and buyer-protection infrastructure, which is incurred regardless of the event outcome.
                </P>
              </Sub>
              <Sub title="6.4 Refund Process">
                <P>
                  To request a refund, submit a complaint via the Ventry Help Center at{' '}
                  <a href={`https://${DOMAIN}/help`} style={{ color: 'var(--color-purple-light)' }}>{DOMAIN}/help</a>.
                  You will need your Ticket ID and the Refund Code included in your ticket confirmation email.
                  Ventry will review your complaint within 5 business days and, if upheld, initiate a refund
                  to your original payment method. Refunds typically appear within 3–7 business days after approval.
                </P>
              </Sub>
              <Sub title="6.5 Force Majeure">
                <P>
                  If an event is cancelled due to genuine force majeure circumstances (natural disaster,
                  government directive, public emergency), Ventry will work with the Organizer to either
                  reschedule the event or issue refunds to affected buyers at Ventry&apos;s discretion.
                  Ventry&apos;s liability in such circumstances is limited to the ticket price, excluding the
                  Service Fee.
                </P>
              </Sub>
            </Section>

            {/* 7 */}
            <Section id="qr-tickets" title="7. QR Tickets & Entry">
              <Sub title="7.1 Ticket Validity">
                <P>
                  Each ticket is represented by a unique, signed QR code. The QR code is valid for a single
                  scan at the event venue. Once scanned, the ticket is marked as used and cannot be used again.
                  A ticket marked as used constitutes evidence of entry.
                </P>
              </Sub>
              <Sub title="7.2 Buyer Responsibility for QR Code">
                <P>
                  Your QR code is your ticket. You are responsible for keeping it private and secure.
                  Ventry strongly advises against:
                </P>
                <Ul items={[
                  'Sharing screenshots of your QR code on social media or messaging apps.',
                  'Allowing third parties to photograph or copy your QR code.',
                  'Forwarding your ticket email to anyone who may attempt to use your ticket.',
                ]} />
                <P>
                  If your QR code is used by someone else before you arrive at the event, Ventry cannot
                  guarantee entry. Ventry accepts no liability for loss suffered as a result of a Buyer
                  sharing their QR code.
                </P>
              </Sub>
              <Sub title="7.3 Organizer Scanning Obligations">
                <P>
                  Organizers are responsible for scanning all QR tickets using the Ventry scanner tool.
                  Organisers must not admit attendees without scanning their QR code, as the scan record
                  is the authoritative record of attendance and is material to any future dispute.
                  Organisers who fail to use the scanner tool waive the right to dispute refund claims
                  based on claimed non-attendance.
                </P>
              </Sub>
              <Sub title="7.4 Technical Failures">
                <P>
                  In the event of a technical failure of the Ventry scanner (network outage, device failure),
                  the Organizer should admit attendees who can produce their Ticket ID and the name registered
                  on the ticket. Ventry accepts no liability for loss of revenue or denied admission resulting
                  from scanner technical failures outside our control.
                </P>
              </Sub>
            </Section>

            {/* 8 */}
            <Section id="prohibited" title="8. Prohibited Activities">
              <P>The following activities are strictly prohibited on the Ventry platform. Violation may result in immediate account termination and, where applicable, referral to law enforcement.</P>
              <Ul items={[
                'Listing events that you do not intend to hold or that are fictitious.',
                'Providing false, forged, or misleading KYC documents.',
                'Using fraudulent payment methods or stolen card details to purchase tickets.',
                'Creating multiple accounts to circumvent a suspension, ban, or KYC review.',
                'Reselling or transferring tickets for profit above face value.',
                'Using automated tools, bots, or scripts to purchase tickets or interact with the Platform.',
                'Attempting to reverse-engineer, exploit, or attack any part of the Ventry platform or its infrastructure.',
                'Using the Platform to launder money or finance prohibited activities.',
                'Harassing, threatening, or impersonating other users, Ventry staff, or any third party.',
                'Listing events that promote illegal activities, violence, hate speech, or exploitation.',
                'Attempting to intercept, alter, or manipulate any QR ticket or the data it contains.',
                'Accessing any account, system, or data that you are not authorised to access.',
              ]} />
            </Section>

            {/* 9 */}
            <Section id="platform-content" title="9. Platform Content">
              <Sub title="9.1 Organizer Content">
                <P>
                  Organizers retain ownership of content they upload to Ventry (event descriptions, banner images, etc.).
                  By uploading content, you grant Ventry a non-exclusive, royalty-free, worldwide licence to
                  display, reproduce, and distribute that content solely for the purpose of operating the Platform
                  and marketing your event. This licence ends when you delete the content or close your account.
                </P>
              </Sub>
              <Sub title="9.2 Content Standards">
                <P>All content submitted to Ventry must comply with Nigerian law and must not be:</P>
                <Ul items={[
                  'Defamatory, obscene, or sexually explicit.',
                  'Infringing of any third-party copyright, trademark, or intellectual property right.',
                  'False, misleading, or deceptive.',
                  'Promoting unlawful activities, violence, or discrimination.',
                ]} />
                <P>
                  Ventry reserves the right to remove any content that violates these standards without notice
                  and without liability to the content owner.
                </P>
              </Sub>
              <Sub title="9.3 Ventry Platform Content">
                <P>
                  All other content on the Platform — including the design, code, text, graphics, and trademarks —
                  is owned by or licenced to Ventry. You may not copy, reproduce, modify, or distribute any part
                  of it without our express written permission.
                </P>
              </Sub>
            </Section>

            {/* 10 */}
            <Section id="liability" title="10. Limitation of Liability">
              <P>
                To the fullest extent permitted by applicable Nigerian law, Ventry&apos;s total liability to you
                for any claim arising from or related to these Terms or your use of the Platform is limited to
                the total amount you paid for the ticket(s) directly involved in the claim.
              </P>
              <P>In particular, Ventry is not liable for:</P>
              <Ul items={[
                'The quality, safety, legality, or cancellation of any event listed on the Platform.',
                'Any acts or omissions of event organizers, including failure to host an event.',
                'Loss suffered as a result of sharing your QR ticket with a third party.',
                'Loss of profit, data, revenue, business opportunity, or goodwill, whether direct or indirect.',
                'Delays in payout processing caused by bank processing times, public holidays, or Paystack outages.',
                'Any failure or interruption of the Platform caused by factors outside our reasonable control, including third-party service outages (Paystack, Supabase, Resend) or network failures.',
                'Indirect, incidental, special, consequential, or punitive damages, even if advised of the possibility.',
              ]} />
              <P>
                Nothing in these Terms limits our liability for fraud, gross negligence, death or personal
                injury caused by our negligence, or any liability that cannot be excluded under Nigerian law.
              </P>
            </Section>

            {/* 11 */}
            <Section id="indemnification" title="11. Indemnification">
              <P>
                You agree to indemnify, defend, and hold harmless Ventry, its officers, employees, contractors,
                and partners from and against any claims, damages, losses, liabilities, costs, and expenses
                (including reasonable legal fees) arising out of or related to:
              </P>
              <Ul items={[
                'Your use or misuse of the Platform.',
                'Your breach of these Terms.',
                'Your violation of any applicable law or third-party right.',
                'Any false, forged, or misleading KYC information you provided.',
                'Any event you listed that you failed to host or that constituted fraud.',
                'Any claim by a Buyer arising from your event that was not caused by Ventry.',
              ]} />
            </Section>

            {/* 12 */}
            <Section id="termination" title="12. Account Termination">
              <Sub title="12.1 Termination by You">
                <P>
                  You may close your account at any time by contacting us at{' '}
                  <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>.
                  Closing your account will not affect your obligations for events already listed or tickets
                  already sold.
                </P>
              </Sub>
              <Sub title="12.2 Termination by Ventry">
                <P>
                  Ventry reserves the right to suspend or permanently terminate your account, without notice,
                  if you:
                </P>
                <Ul items={[
                  'Breach any provision of these Terms.',
                  'Provide false KYC information.',
                  'Engage in any prohibited activity listed in Section 8.',
                  'Create multiple accounts to circumvent a previous termination.',
                  'Pose a risk of legal liability or reputational harm to Ventry.',
                  'Fail to host an event without providing a valid reason and initiating refunds.',
                ]} />
              </Sub>
              <Sub title="12.3 Effect of Termination">
                <P>
                  On termination, your right to use the Platform ceases immediately. If your organizer account is
                  terminated while events are live:
                </P>
                <Ul items={[
                  'All upcoming events will be taken offline.',
                  'All affected ticket buyers will receive a full refund (excluding Service Fees).',
                  'Any escrowed funds owed to you may be withheld pending resolution of all outstanding refunds and complaints.',
                ]} />
                <P>Sections 5, 6, 10, 11, 13, and 14 survive termination of these Terms.</P>
              </Sub>
            </Section>

            {/* 13 */}
            <Section id="dispute-resolution" title="13. Dispute Resolution">
              <Sub title="13.1 Buyer–Organizer Disputes">
                <P>
                  In the first instance, disputes between Buyers and Organizers regarding an event should be
                  raised through the Ventry Help Center. Ventry will act as a neutral facilitator and make
                  a binding determination on refund eligibility based on available evidence, including QR
                  scan logs, event listing details, and communications on the Platform.
                </P>
              </Sub>
              <Sub title="13.2 Disputes with Ventry">
                <P>
                  Disputes between you and Ventry should first be raised by emailing{' '}
                  <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>.
                  We will attempt to resolve the matter informally within 30 days. If the dispute cannot
                  be resolved informally, it may be submitted to mediation or arbitration under Nigerian law
                  before any court proceedings are initiated.
                </P>
              </Sub>
              <Sub title="13.3 Chargebacks">
                <P>
                  If you initiate a chargeback or payment dispute with your bank or card issuer without first
                  seeking resolution through the Ventry platform, we reserve the right to suspend your account,
                  contest the chargeback with evidence, and recover the disputed amount plus any chargeback
                  fees from future transactions.
                </P>
              </Sub>
            </Section>

            {/* 14 */}
            <Section id="governing-law" title="14. Governing Law">
              <P>
                These Terms of Service are governed by and construed in accordance with the laws of the
                <strong> Federal Republic of Nigeria</strong>, without regard to conflict of law principles.
                Any dispute that is not resolved by the process in Section 13 shall be subject to the exclusive
                jurisdiction of the courts of the Federal Republic of Nigeria.
              </P>
              <P>
                If you are located outside Nigeria, you acknowledge that you are using the Platform subject
                to Nigerian law and you consent to the jurisdiction of Nigerian courts for any dispute
                arising from your use of the Platform.
              </P>
            </Section>

            {/* 15 */}
            <Section id="changes" title="15. Changes to Terms">
              <P>
                Ventry reserves the right to modify these Terms at any time. When we make material changes, we will:
              </P>
              <Ul items={[
                'Update the "Last updated" date at the top of this page.',
                'Notify active organizer account holders by email at least 14 days before the changes take effect.',
                'Where required by law, seek your affirmative agreement before applying new terms to existing transactions.',
              ]} />
              <P>
                If you continue to use the Platform after the effective date of revised Terms, you are deemed
                to have accepted the revised Terms. If you do not agree to the revised Terms, you must stop
                using the Platform and may close your account as described in Section 12.
              </P>
              <P>
                We recommend saving or bookmarking this page and checking it periodically.
              </P>
            </Section>

            {/* 16 */}
            <Section id="contact" title="16. Contact Us">
              <P>
                Questions about these Terms, or requests for clarification, should be directed to:
              </P>
              <div
                className="rounded-xl border p-5 text-sm flex flex-col gap-1.5"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Ventry Legal</p>
                <p>Email: <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a></p>
                <p>Website: <a href={`https://${DOMAIN}`} style={{ color: 'var(--color-purple-light)' }}>{DOMAIN}</a></p>
                <p>Jurisdiction: Federal Republic of Nigeria</p>
              </div>
              <P>
                We will acknowledge all legal enquiries within 5 business days.
              </P>
            </Section>

            {/* Footer nav */}
            <div
              className="pt-8 border-t flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center text-xs"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
            >
              <span>© {new Date().getFullYear()} Ventry. All rights reserved.</span>
              <div className="flex gap-4">
                <Link href="/terms" style={{ color: 'var(--color-purple-light)' }}>Terms of Service</Link>
                <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>
              </div>
            </div>

          </article>
        </div>
      </div>

      <Footer />
    </div>
  );
}
