import Link from 'next/link';
import {
  Shield,
  UserCheck,
  QrCode,
  RotateCcw,
  ArrowRight,
  Lock,
  BadgeCheck,
  Zap,
} from 'lucide-react';
// Revalidate the homepage every 60 seconds so the featured events stay fresh
// without hitting Supabase on every single page request.
export const revalidate = 60;

import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { EventCard } from '@/components/events/EventCard';
import { Button } from '@/components/ui/Button';
import { getServerSupabase } from '@/lib/supabase/server';

const trustBadges = [
  { icon: Shield, label: 'Escrow Protected' },
  { icon: UserCheck, label: 'Verified Organizers' },
  { icon: QrCode, label: 'Instant QR Tickets' },
  { icon: RotateCcw, label: 'Automatic Refunds' },
];

const howItWorksSteps = [
  {
    step: 1,
    title: 'Browse & Choose',
    desc: 'Discover verified events from trusted organizers across Nigeria.',
  },
  {
    step: 2,
    title: 'Pay Securely',
    desc: 'Your payment is held in escrow — not released until the event happens.',
  },
  {
    step: 3,
    title: 'Get Your QR',
    desc: 'Receive your unique QR ticket instantly to your email.',
  },
  {
    step: 4,
    title: 'Show Up & Scan',
    desc: 'Present your QR code at the entrance for instant verification.',
  },
];

const trustFeatures = [
  {
    icon: Lock,
    title: 'Escrow Payments',
    desc: 'Buyer money is held securely by Ventry and only released to organizers after the event successfully takes place.',
  },
  {
    icon: BadgeCheck,
    title: 'Verified Organizers',
    desc: 'Every organizer on Ventry passes a full KYC review — identity, phone, and venue verification — before going live.',
  },
  {
    icon: RotateCcw,
    title: 'Automatic Refunds',
    desc: 'If an event is cancelled or flagged as fraudulent, refunds are triggered automatically. No arguing, no waiting.',
  },
];

export default async function HomePage() {
  const db = getServerSupabase();
  const { data: rawEvents } = await db
    .from('events')
    .select(`
      id, event_name, category, description, date, time, venue, address, city,
      status, total_sold, banner_color, banner_url,
      organizer:users!events_organizer_id_fkey(id, name, tier, verified, member_since, events_hosted),
      tiers:ticket_tiers(id, name, price, available, sold)
    `)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function one<T>(v: T[] | T | null | undefined): T | null {
    if (v == null) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featuredEvents = (rawEvents ?? []).map((row: any) => {
    const tiers: { id: string; name: string; price: number; available: number; sold: number }[] =
      (Array.isArray(row.tiers) ? row.tiers : []) ?? [];
    const totalAvailable = tiers.reduce((s, t) => s + t.available, 0);
    const totalSold      = tiers.reduce((s, t) => s + t.sold, 0);
    const remaining      = totalAvailable - totalSold;
    const badge =
      remaining === 0                                             ? ('sold_out'     as const)
      : totalAvailable > 0 && remaining / totalAvailable <= 0.2  ? ('limited'      as const)
      : totalAvailable > 0 && totalSold  / totalAvailable >= 0.5 ? ('selling_fast' as const)
      : undefined;

    const organizer = one(row.organizer) ?? {
      id: '', name: '', email: '', phone: '', tier: 'Standard',
      verified: false, memberSince: '', eventsHosted: 0, kycStatus: 'pending',
    };

    return {
      id:          row.id,
      name:        row.event_name,
      category:    row.category,
      description: row.description,
      date:        row.date,
      time:        row.time,
      venue:       row.venue,
      address:     row.address,
      city:        row.city,
      status:      row.status,
      bannerColor: row.banner_color,
      banner_url:  row.banner_url ?? null,
      totalSold:   row.total_sold,
      badge,
      organizer,
      tiers,
    };
  });
  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(124,58,237,0.18) 0%, transparent 70%)',
          }}
        />
        <div className="absolute inset-0 grid-pattern pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center py-20">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8 border"
            style={{
              backgroundColor: 'var(--color-purple-dim)',
              borderColor: '#7c3aed40',
              color: 'var(--color-purple-light)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--color-purple-light)' }}
            />
            Vibes on Vibes
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6 break-words"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-syne), sans-serif',
              overflowWrap: 'break-word',
            }}
          >
            The Party.{' '}
            <span style={{ color: 'var(--color-purple)' }}>Starts Here.</span>
          </h1>

          <p
            className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Discover and buy tickets to the best parties, concerts, uni events and more across Nigeria. Your money is protected in escrow — and fully refundable if anything goes wrong.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <Link href="/events">
              <Button size="lg">
                Discover Events
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/organizer/register">
              <Button size="lg" variant="outline">
                List Your Event
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {trustBadges.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <Icon size={14} className="flex-shrink-0" style={{ color: 'var(--color-purple)' }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Events */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-center justify-between mb-8">
          <h2
            className="text-3xl font-bold"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-syne), sans-serif',
            }}
          >
            Featured Events
          </h2>
          <Link
            href="/events"
            className="flex items-center gap-1 text-sm font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            See All <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(featuredEvents ?? []).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="py-20 border-y"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2
              className="text-3xl font-bold mb-3"
              style={{
                color: 'var(--color-text)',
                fontFamily: 'var(--font-syne), sans-serif',
              }}
            >
              How It Works
            </h2>
            <p style={{ color: 'var(--color-text-muted)' }}>
              Four simple steps to safe, secure tickets.
            </p>
          </div>

          <div className="relative">
            <div
              className="absolute top-10 left-[12.5%] right-[12.5%] h-px hidden md:block"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to right, var(--color-border) 0, var(--color-border) 8px, transparent 8px, transparent 16px)',
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {howItWorksSteps.map(({ step, title, desc }) => (
                <div key={step} className="relative flex flex-col items-center text-center gap-4">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center border-2 relative z-10"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      borderColor: 'var(--color-purple)',
                    }}
                  >
                    <span
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: 'var(--color-purple)' }}
                    >
                      {step}
                    </span>
                    <span
                      className="text-2xl font-bold"
                      style={{ color: 'var(--color-purple)', fontFamily: 'var(--font-syne), sans-serif' }}
                    >
                      {step}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
                      {title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2
            className="text-3xl font-bold mb-3"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-syne), sans-serif',
            }}
          >
            Built on Trust, Not Hope
          </h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Every feature exists to protect you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {trustFeatures.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-8 rounded-xl border flex flex-col gap-4"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--color-purple-dim)',
                  color: 'var(--color-purple-light)',
                }}
              >
                <Icon size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* For Organizers CTA */}
      <section id="for-organizers" className="max-w-7xl mx-auto px-6 pb-20">
        <div
          className="rounded-2xl p-10 md:p-14 text-center border"
          style={{
            background: 'linear-gradient(135deg, #1a0a3d 0%, #0f0a2d 100%)',
            borderColor: '#7c3aed40',
          }}
        >
          <Zap size={32} className="mx-auto mb-5" style={{ color: 'var(--color-purple-light)' }} />
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: '#fff', fontFamily: 'var(--font-syne), sans-serif' }}
          >
            Ready to sell tickets?
          </h2>
          <p className="text-base mb-8 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
            No upfront costs. 2.5% only after your event. Full sales dashboard included.
          </p>
          <Link href="/organizer/register">
            <Button size="lg">
              Become an Organizer
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
