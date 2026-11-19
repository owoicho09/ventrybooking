import type { Metadata } from 'next';
import Link from 'next/link';
import { Unbounded } from 'next/font/google';
import {
  TOP_SIX, REASON_GROUPS, STEPS, ORGANIZER_SIGNUP_HREF, ORGANIZER_CONTACT_EMAIL,
  type TopReason, type ReasonGroup as ReasonGroupData, type StepItem,
} from '@/lib/organizerReasons';
import './organizers.css';

// Marketing page for event organisers ("List your event" lands here).
// Static server component; the only interaction is the #reasons anchor,
// smooth-scrolled in CSS.

const display = Unbounded({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-org-display', display: 'swap' });

const TITLE = 'Become a Ventry organizer: 36 reasons';
const DESCRIPTION = 'Free to list. 3% only when you sell. Your money lands the next working day.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/organizers' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://www.ventrybooking.com/organizers',
    siteName: 'Ventry',
    type: 'website',
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/opengraph-image'] },
};

function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

function CtaButton({ size = 'lg', variant = 'acc' }: { size?: 'sm' | 'lg'; variant?: 'acc' | 'white' }) {
  return (
    <Link href={ORGANIZER_SIGNUP_HREF} className={`vorg-btn vorg-btn-${size} vorg-btn-${variant}`}>
      Become an organizer <ArrowRight />
    </Link>
  );
}

function StatCard({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="vorg-stat">
      <div className="vorg-stat-n">{value}</div>
      <div className="vorg-stat-l">{label}</div>
    </div>
  );
}

function FeatureCard({ item }: { item: TopReason }) {
  return (
    <article className="vorg-feature">
      <span className="vorg-feature-n">{item.n}</span>
      <h3>{item.title}</h3>
      <p>{item.body}</p>
    </article>
  );
}

function ReasonGroup({ group }: { group: ReasonGroupData }) {
  return (
    <div className="vorg-group">
      <h3>{group.label}</h3>
      <ul>
        {group.items.map(r => (
          <li key={r.n}>
            <span>{r.n}</span>
            <div><strong>{r.bold}</strong>{r.rest}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ step }: { step: StepItem }) {
  return (
    <div className="vorg-step">
      <span className="vorg-step-n" aria-hidden="true">{step.n}</span>
      <div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
      </div>
    </div>
  );
}

export default function OrganizersPage() {
  return (
    <div className={`vorg ${display.variable}`}>
      <div className="vorg-wrap">
        <header className="vorg-header">
          <Link href="/" className="vorg-logo" aria-label="Ventry home"><span>V</span>ENTRY</Link>
          <CtaButton size="sm" />
        </header>

        <main>
          <section className="vorg-hero">
            <span className="vorg-eyebrow">FOR ORGANIZERS</span>
            <h1 className="vorg-h1"><span>36 reasons</span> to sell your tickets on Ventry.</h1>
            <p className="vorg-hero-sub">Free to list. 3% only when you sell. Your money lands the next working day.</p>
            <div className="vorg-actions">
              <CtaButton />
              <a href="#reasons" className="vorg-btn vorg-btn-lg vorg-btn-outline">See all 36 reasons <ArrowDown /></a>
            </div>
          </section>

          <section className="vorg-section vorg-stats" aria-label="Ventry in numbers">
            <StatCard value="₦0" label="to list your event" />
            <StatCard value={<><s>5%</s>3%</>} label="platform fee" />
            <StatCard value="97%" label="of every ticket is yours" />
            <StatCard value="Next day" label="your money settles" />
          </section>

          <section className="vorg-section" aria-labelledby="vorg-top">
            <h2 id="vorg-top" className="vorg-h2">The ones organizers switch for.</h2>
            <p className="vorg-sub">Start with these six. The rest are below.</p>
            <div className="vorg-features vorg-grid-gap">
              {TOP_SIX.map(item => <FeatureCard key={item.n} item={item} />)}
            </div>
          </section>

          <section className="vorg-section" id="reasons" aria-labelledby="vorg-all">
            <h2 id="vorg-all" className="vorg-h2">All 36 reasons.</h2>
            <p className="vorg-sub">Everything here is included. Listing is free.</p>
            <div className="vorg-reasons vorg-grid-gap">
              {REASON_GROUPS.map(g => <ReasonGroup key={g.label} group={g} />)}
            </div>
          </section>

          <section className="vorg-section" aria-labelledby="vorg-steps">
            <h2 id="vorg-steps" className="vorg-h2">Start in three steps.</h2>
            <div className="vorg-steps vorg-grid-gap">
              {STEPS.map(s => <Step key={s.n} step={s} />)}
            </div>
          </section>

          <section className="vorg-section vorg-cta" aria-labelledby="vorg-cta">
            <h2 id="vorg-cta">Ready to sell your next event?</h2>
            <p className="vorg-cta-body">Free to list. 3% only when a ticket sells. Paid the next working day.</p>
            <CtaButton variant="white" />
            <p className="vorg-cta-small">Questions? <a href={`mailto:${ORGANIZER_CONTACT_EMAIL}`}>{ORGANIZER_CONTACT_EMAIL}</a></p>
          </section>
        </main>

        <footer className="vorg-footer">Ventry Solutions · ventrybooking.com</footer>
      </div>
    </div>
  );
}
