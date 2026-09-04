import Link from 'next/link';
import { Users, Link2, Wallet, CheckCircle } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';

const steps = [
  {
    icon: Users,
    title: 'Sign up free',
    body: 'Create your affiliate account in under a minute — no approval wait, no fees.',
  },
  {
    icon: Link2,
    title: 'Share your referral link',
    body: 'Every affiliate gets a unique link. Send it to organisers you know who should be selling tickets on Ventry.',
  },
  {
    icon: Wallet,
    title: 'Earn on their first 2 events',
    body: "When someone signs up through your link and runs an event, you earn 30% of Ventry's service fee on their first two events.",
  },
];

const faqs = [
  {
    q: 'How much do I actually earn?',
    a: 'You earn 30% of Ventry\'s service fee on every event your referred organiser runs, for their first 2 events only.',
  },
  {
    q: 'How is a referral tracked?',
    a: 'Your unique link sets a 30-day cookie the moment someone visits it — on any page, not just the signup page. If they register as an organiser within that window, they’re credited to you permanently.',
  },
  {
    q: 'When do I get paid?',
    a: 'Commission accrues automatically as your referred organiser sells tickets. Payouts are processed by Ventry admin — check your dashboard for your pending and paid totals.',
  },
  {
    q: 'Is there a limit?',
    a: 'No limit on how many organisers you refer. The 2-event cap applies per organiser, not to you overall.',
  },
];

export default function AffiliatesLandingPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />

      <div className="pt-16">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 py-16 sm:py-24 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-purple)' }}>
            Ventry Affiliate Program
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold mb-5 max-w-3xl mx-auto" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            Bring in organisers. Earn on every ticket they sell.
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto mb-10" style={{ color: 'var(--color-text-muted)' }}>
            Know an event organiser who isn&apos;t on Ventry yet? Refer them, and earn <strong style={{ color: 'var(--color-text)' }}>30% of Ventry&apos;s service fee</strong> — on their first two events. No cap on how many organisers you refer.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/affiliate/register"><Button size="lg">Become an Affiliate</Button></Link>
            <Link href="/affiliate/login">
              <Button size="lg" variant="outline">Affiliate Sign In</Button>
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-5xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-10" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.title} className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
                  <step.icon size={18} />
                </div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-purple)' }}>STEP {i + 1}</p>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why it works well */}
        <section className="max-w-5xl mx-auto px-6 py-12">
          <div className="rounded-xl border p-6 sm:p-8" style={{ backgroundColor: 'var(--color-purple-dim)', borderColor: '#7c3aed30' }}>
            <div className="flex items-start gap-3">
              <CheckCircle size={20} style={{ color: 'var(--color-purple-light)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Attribution that actually works</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  Your referral link is tracked the moment someone clicks it — on any page of the site — and stays attributed to you for 30 days, whether they sign up right away or come back later. First click wins, always.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-center mb-10" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            Common questions
          </h2>
          <div className="flex flex-col gap-4">
            {faqs.map(faq => (
              <div key={faq.q} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <p className="font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>{faq.q}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            Ready to start earning?
          </h2>
          <Link href="/affiliate/register"><Button size="lg">Become an Affiliate</Button></Link>
        </section>
      </div>

      <Footer />
    </div>
  );
}
