import Link from 'next/link';
import { ArrowRight, ShoppingBag, Calendar, ShieldCheck } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';

const cards = [
  {
    href: '/terms/buyers',
    icon: ShoppingBag,
    title: 'Buyer Terms of Use',
    description: 'What you pay, how escrow protects you, and when you’re entitled to a refund as a ticket buyer.',
    version: 'Version 1.1 · Effective 19 August 2026',
  },
  {
    href: '/terms/organisers',
    icon: Calendar,
    title: 'Organiser Terms of Use',
    description: 'Fees, payouts, venue proof, lineup rules, and when a payout can be withheld as an event organiser.',
    version: 'Version 1.1 · Effective 19 August 2026',
  },
  {
    href: '/refund-policy',
    icon: ShieldCheck,
    title: 'Refund Policy',
    description: 'The full detail on when a ticket is refunded, what portion is returned, and how to request one.',
    version: 'Version 2.1 · Effective 19 August 2026',
  },
];

export default function TermsLandingPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />

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
            Terms of Use
          </h1>
          <p className="text-sm max-w-xl" style={{ color: 'var(--color-text-muted)' }}>
            Ventry publishes separate terms for buyers and organisers, since each governs a different relationship with
            the platform. Pick the one that applies to you.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid gap-4 sm:grid-cols-1">
          {cards.map(({ href, icon: Icon, title, description, version }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-xl border p-6 transition-colors hover:border-[var(--color-purple)]"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div
                className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}
              >
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
                  {title}
                </h2>
                <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{version}</p>
              </div>
              <ArrowRight size={18} className="flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--color-text-dim)' }} />
            </Link>
          ))}
        </div>

        <p className="text-xs mt-8" style={{ color: 'var(--color-text-dim)' }}>
          Also see our <Link href="/privacy" className="hover:underline" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>.
        </p>
      </div>

      <Footer />
    </div>
  );
}
