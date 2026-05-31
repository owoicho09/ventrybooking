import Link from 'next/link';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';

const LAST_UPDATED = '31 May 2026';
const EFFECTIVE    = '31 May 2026';
const EMAIL        = 'support@ventrybooking.com';
const DOMAIN       = 'ventrybooking.com';

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
  { id: 'information-we-collect',     label: '1. Information We Collect' },
  { id: 'how-we-use',                 label: '2. How We Use Your Information' },
  { id: 'third-parties',              label: '3. Third-Party Services' },
  { id: 'data-sharing',               label: '4. Data Sharing & Disclosure' },
  { id: 'data-retention',             label: '5. Data Retention & Deletion' },
  { id: 'your-rights',                label: '6. Your Rights' },
  { id: 'cookies',                    label: '7. Cookies & Tracking' },
  { id: 'security',                   label: '8. Data Security' },
  { id: 'children',                   label: '9. Children\'s Privacy' },
  { id: 'changes',                    label: '10. Changes to This Policy' },
  { id: 'contact',                    label: '11. Contact Us' },
];

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Last updated: <strong style={{ color: 'var(--color-text)' }}>{LAST_UPDATED}</strong>
            &ensp;·&ensp;Effective: <strong style={{ color: 'var(--color-text)' }}>{EFFECTIVE}</strong>
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex flex-col lg:flex-row gap-12">

          {/* Table of contents — sticky on desktop */}
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

            <div className="rounded-xl border p-5 text-sm leading-relaxed"
              style={{ backgroundColor: 'var(--color-purple-dim)', borderColor: '#7c3aed30', color: 'var(--color-purple-light)' }}>
              This Privacy Policy explains how Ventry (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) collects, uses, and protects
              information about you when you use <strong>{DOMAIN}</strong> and related services.
              By using Ventry, you agree to the practices described in this policy.
            </div>

            {/* 1 */}
            <Section id="information-we-collect" title="1. Information We Collect">
              <P>
                We collect information that is necessary to operate a secure, trustworthy ticketing platform.
                The type of data we collect depends on whether you use Ventry as a ticket buyer or as an event organizer.
              </P>

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>1.1 Information You Provide Directly</p>
              <Ul items={[
                <><strong>Buyers:</strong> name, email address, and any other information you supply when purchasing tickets or submitting a refund claim.</>,
                <><strong>Organizers:</strong> name, email address, phone number, and password when registering an account.</>,
                <><strong>KYC documents (organizers only):</strong> government-issued photo ID, a selfie holding your ID, social media profile links, venue proof documents, and bank account details (bank name, account number, and account name) required to release payouts.</>,
                <><strong>Event details:</strong> event name, description, date, venue, address, city, ticket tier pricing, and any banner images you upload.</>,
                <><strong>Support communications:</strong> the content of any message you send to us via email or the help center, including refund claims and complaints.</>,
              ]} />

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>1.2 Information Collected Automatically</p>
              <Ul items={[
                'IP address and approximate geographic location derived from it.',
                'Browser type, operating system, and device identifiers.',
                'Pages visited on the Ventry platform, timestamps, and referring URLs.',
                'Authentication session tokens stored in secure HTTP-only cookies.',
              ]} />

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>1.3 Payment Information</p>
              <P>
                We do not store full card numbers, PINs, or other sensitive payment credentials on our servers.
                All payment processing is handled directly by <strong>Paystack</strong>. When you make a purchase,
                your payment details are transmitted directly to Paystack under their own privacy policy.
                We receive and store only the transaction reference number, the amount paid, and the payment status
                returned by Paystack.
              </P>
            </Section>

            {/* 2 */}
            <Section id="how-we-use" title="2. How We Use Your Information">
              <P>We use the information we collect for the following purposes:</P>

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>2.1 Delivering Tickets & Processing Payments</p>
              <Ul items={[
                'Generating your unique QR-coded ticket and delivering it to your email address after a successful purchase.',
                'Creating a secure payment transaction on Paystack and reconciling the outcome with your order.',
                'Holding funds in escrow and releasing them to the organizer after the event.',
                'Processing refunds when an event is cancelled or a complaint is upheld.',
              ]} />

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>2.2 KYC Verification (Organizers)</p>
              <Ul items={[
                'Reviewing identity documents to verify that organizers are real individuals or registered businesses.',
                'Validating phone numbers and social media presence as part of the trust-verification process.',
                'Confirming venue documentation before approving event listings.',
                'Preventing fraud, money laundering, and the listing of fictitious events.',
              ]} />

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>2.3 Platform Operations</p>
              <Ul items={[
                'Creating and managing your account, authenticating your identity on each login.',
                'Sending transactional emails: ticket confirmations, KYC decisions, event approvals or rejections, payout notifications, and password reset links.',
                'Enabling event organizers to scan and validate QR tickets at their events.',
                'Providing organizers with sales analytics and payout records via the dashboard.',
              ]} />

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>2.4 Safety, Security & Fraud Prevention</p>
              <Ul items={[
                'Detecting and investigating fraudulent transactions, fake events, or abuse of the refund system.',
                'Monitoring for compromised accounts and unauthorized access.',
                'Maintaining audit logs of QR scan events for dispute resolution.',
              ]} />

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>2.5 Legal Compliance</p>
              <P>
                We may use your information to comply with applicable Nigerian laws and regulations,
                respond to lawful requests from government authorities, and enforce our Terms of Service.
              </P>
            </Section>

            {/* 3 */}
            <Section id="third-parties" title="3. Third-Party Services">
              <P>
                We engage a small number of carefully selected third-party service providers to operate the platform.
                Each provider processes data only as necessary to perform their specific function.
              </P>

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>3.1 Paystack (Payment Processing)</p>
              <P>
                Ventry uses <strong>Paystack Inc.</strong> to process all ticket payments and organizer transfers.
                When you purchase a ticket, you are redirected to Paystack's hosted payment page.
                Paystack collects, processes, and stores your card details under their own privacy policy,
                available at paystack.com/privacy. We receive only a transaction reference and payment status.
                Paystack is PCI-DSS compliant.
              </P>

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>3.2 Resend (Transactional Email)</p>
              <P>
                We use <strong>Resend Inc.</strong> to deliver transactional emails — ticket confirmations,
                password resets, and platform notifications. Resend processes your email address and the content
                of each message sent on our behalf. Resend does not use this data for advertising.
                Their privacy policy is available at resend.com/legal/privacy-policy.
              </P>

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>3.3 Supabase (Database & File Storage)</p>
              <P>
                Our database, file storage, and backend infrastructure are hosted on <strong>Supabase Inc.</strong>
                All data described in this policy — account records, ticket records, KYC documents, event data —
                is stored on Supabase infrastructure with encryption at rest and in transit.
                KYC documents are stored in a private, access-controlled storage bucket and are not publicly accessible.
                Supabase's privacy policy is available at supabase.com/privacy.
              </P>

              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>3.4 No Advertising Partners</p>
              <P>
                We do not sell your personal data to advertisers. We do not use your data for targeted advertising.
                We do not work with data brokers or marketing analytics companies.
              </P>
            </Section>

            {/* 4 */}
            <Section id="data-sharing" title="4. Data Sharing & Disclosure">
              <P>We do not sell, rent, or trade your personal information. We may share it only in the following circumstances:</P>
              <Ul items={[
                <><strong>With event organizers:</strong> when you purchase a ticket, the organizer receives your name and email address so they can manage attendance. They do not receive your payment card details.</>,
                <><strong>With our service providers:</strong> Paystack, Resend, and Supabase as described in Section 3, solely to provide the services you use.</>,
                <><strong>For legal compliance:</strong> when required by law, court order, or a lawful request from a Nigerian government authority, regulatory body, or law enforcement agency.</>,
                <><strong>To protect rights:</strong> when we believe in good faith that disclosure is necessary to prevent fraud, protect the safety of any person, or enforce our Terms of Service.</>,
                <><strong>In a business transfer:</strong> if Ventry is acquired, merged, or its assets are transferred, your data may be transferred as part of that transaction. We will notify affected users before their data is subject to a different privacy policy.</>,
              ]} />
            </Section>

            {/* 5 */}
            <Section id="data-retention" title="5. Data Retention & Deletion">
              <P>We retain your data for as long as necessary to fulfil the purposes set out in this policy.</P>
              <Ul items={[
                <><strong>Ticket records:</strong> retained for 7 years from the transaction date to satisfy financial record-keeping obligations under Nigerian law.</>,
                <><strong>Account data:</strong> retained for the life of your account. If you close your account, personal profile data is deleted within 30 days, subject to financial retention requirements above.</>,
                <><strong>KYC documents:</strong> retained while your organizer account is active and for 2 years after account closure to comply with anti-fraud and anti-money-laundering obligations.</>,
                <><strong>Support communications:</strong> retained for 2 years to allow resolution of disputes and charge-backs.</>,
                <><strong>Server and access logs:</strong> retained for 90 days and then automatically deleted.</>,
              ]} />
              <P>
                To request deletion of your account and associated data, email us at{' '}
                <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>.
                We will acknowledge your request within 5 business days and complete deletion within 30 days,
                except where retention is required by law.
              </P>
            </Section>

            {/* 6 */}
            <Section id="your-rights" title="6. Your Rights">
              <P>
                As a user of the Ventry platform you have the following rights regarding your personal data.
                You may exercise any of these rights by emailing{' '}
                <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>.
              </P>
              <Ul items={[
                <><strong>Right of access:</strong> you may request a copy of the personal data we hold about you.</>,
                <><strong>Right to rectification:</strong> you may ask us to correct inaccurate or incomplete data. Organizers can update most profile data directly in the dashboard.</>,
                <><strong>Right to erasure:</strong> you may request deletion of your personal data, subject to retention requirements described in Section 5.</>,
                <><strong>Right to data portability:</strong> you may request that we export your data in a machine-readable format (JSON or CSV).</>,
                <><strong>Right to restrict processing:</strong> you may ask us to suspend processing of your data while a correction or objection is being resolved.</>,
                <><strong>Right to object:</strong> you may object to processing of your data for purposes other than the core service delivery.</>,
              ]} />
              <P>
                We will respond to all rights requests within 30 days. If we are unable to action your request,
                we will explain why.
              </P>
            </Section>

            {/* 7 */}
            <Section id="cookies" title="7. Cookies & Tracking">
              <P>
                Ventry uses a minimal set of cookies necessary to operate the platform securely.
                We do not use advertising cookies, tracking pixels, or third-party analytics scripts
                that build profiles across the web.
              </P>
              <Ul items={[
                <><strong>Authentication cookie (<code>ventry_token</code>):</strong> an HTTP-only, secure, SameSite=Lax cookie that holds your signed session token. This cookie is essential for you to remain logged in. It cannot be read by JavaScript and expires after 7 days or on logout, whichever is earlier.</>,
                <><strong>No advertising cookies:</strong> we do not set cookies from Google Ads, Meta, or any other advertising network.</>,
                <><strong>No third-party analytics:</strong> we do not embed Google Analytics, Mixpanel, or similar tools. Any analytics we run are first-party and use anonymised aggregated data only.</>,
              ]} />
              <P>
                Because we use only one essential cookie, cookie consent banners are not required for our platform.
                You may disable cookies in your browser settings, but doing so will prevent you from logging in.
              </P>
            </Section>

            {/* 8 */}
            <Section id="security" title="8. Data Security">
              <Ul items={[
                'All data transmitted between your browser and our servers is encrypted using TLS 1.2 or higher.',
                'Data at rest is encrypted by Supabase using AES-256.',
                'KYC documents are stored in a private Supabase storage bucket inaccessible to the public.',
                'Passwords are never stored in plain text; they are hashed using bcrypt with an appropriate work factor.',
                'QR ticket tokens are signed JWTs with a 365-day expiry, verified server-side on every scan.',
                'Authentication tokens use HTTP-only cookies, preventing JavaScript access.',
                'Admin and organizer access requires authentication; admin credentials are never stored in the database.',
                'We perform periodic security reviews of our API routes and access controls.',
              ]} />
              <P>
                No system is completely secure. If you discover a security vulnerability in the Ventry platform,
                please report it responsibly to{' '}
                <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>{' '}
                and we will respond promptly.
              </P>
            </Section>

            {/* 9 */}
            <Section id="children" title="9. Children's Privacy">
              <P>
                Ventry is not directed at children under the age of 18. We do not knowingly collect personal
                information from anyone under 18. If you are a parent or guardian and believe your child has
                provided us with personal information, please contact us at{' '}
                <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>{' '}
                and we will delete it promptly.
              </P>
            </Section>

            {/* 10 */}
            <Section id="changes" title="10. Changes to This Policy">
              <P>
                We may update this Privacy Policy from time to time to reflect changes in our practices,
                technology, legal requirements, or for other operational reasons. When we make material changes,
                we will update the &quot;Last updated&quot; date at the top of this page and, where appropriate,
                notify organizer account holders by email.
              </P>
              <P>
                Your continued use of the Ventry platform after changes are posted constitutes your acceptance
                of the updated policy. We encourage you to review this page periodically.
              </P>
            </Section>

            {/* 11 */}
            <Section id="contact" title="11. Contact Us">
              <P>
                If you have any questions, concerns, or requests regarding this Privacy Policy or how we
                handle your personal data, please contact us:
              </P>
              <div
                className="rounded-xl border p-5 text-sm flex flex-col gap-1.5"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Ventry Privacy Team</p>
                <p>Email: <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a></p>
                <p>Website: <a href={`https://${DOMAIN}`} style={{ color: 'var(--color-purple-light)' }}>{DOMAIN}</a></p>
                <p>Jurisdiction: Federal Republic of Nigeria</p>
              </div>
              <P>
                We will acknowledge privacy-related enquiries within 5 business days and aim to resolve them
                within 30 days.
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
