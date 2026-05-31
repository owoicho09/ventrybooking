'use client';

import { useState } from 'react';
import { XCircle, AlertTriangle, QrCode, CreditCard, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type HelpCategory = 'cancelled' | 'fraud' | 'ticket' | 'payment' | null;

const categories = [
  {
    id: 'cancelled' as HelpCategory,
    icon: XCircle,
    title: 'Event Cancelled',
    desc: 'Claim your automatic refund',
    color: 'var(--color-red)',
  },
  {
    id: 'fraud' as HelpCategory,
    icon: AlertTriangle,
    title: 'Fake or Fraud Event',
    desc: 'Report a suspicious listing',
    color: 'var(--color-amber)',
  },
  {
    id: 'ticket' as HelpCategory,
    icon: QrCode,
    title: 'Ticket Issue',
    desc: 'QR not working or not received',
    color: 'var(--color-purple)',
  },
  {
    id: 'payment' as HelpCategory,
    icon: CreditCard,
    title: 'Payment Issue',
    desc: 'Charged but no ticket received',
    color: 'var(--color-green)',
  },
];

const claimSteps = [
  { label: 'Claim Submitted', done: true },
  { label: 'Ticket Verified', done: true, active: false },
  { label: 'Refund Processing', done: false, active: true },
  { label: 'Refund Complete', done: false },
];

const faqItems = [
  {
    q: 'How long does a refund take?',
    a: 'Once approved, refunds are processed within 3-5 business days to your original payment method.',
  },
  {
    q: 'What counts as a cancelled event?',
    a: 'An event is considered cancelled when the organizer officially cancels it through Ventry, or when Ventry deems it fraudulent after investigation.',
  },
  {
    q: 'Can I get a refund if I change my mind?',
    a: 'No. Ventry refund protection only covers event cancellations and fraud. Buyer change of mind is not covered.',
  },
  {
    q: 'What is the Refund Protection Code?',
    a: 'Your Refund Protection Code (RF-XXXX-XX) is included in your ticket email. It is used to verify your claim identity.',
  },
];

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState<HelpCategory>(null);
  const [ticketId, setTicketId] = useState('');
  const [refundCode, setRefundCode] = useState('');
  const [email, setEmail] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showTracker, setShowTracker] = useState(false);

  const handleCategoryClick = (id: HelpCategory) => {
    setActiveCategory((prev) => (prev === id ? null : id));
    setShowTracker(false);
  };

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    setShowTracker(true);
  };

  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />
      <div className="pt-16 max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1
            className="text-4xl font-bold mb-3"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
          >
            How can we help you?
          </h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Select an issue type below and we&apos;ll guide you through the resolution.
          </p>
        </div>

        {/* Category cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {categories.map(({ id, icon: Icon, title, desc, color }) => {
            const isActive = activeCategory === id;
            return (
              <button
                key={id}
                onClick={() => handleCategoryClick(id)}
                className="text-left rounded-xl border p-5 flex items-start gap-4 transition-all"
                style={{
                  backgroundColor: isActive ? `${color}10` : 'var(--color-surface)',
                  borderColor: isActive ? `${color}60` : 'var(--color-border)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${color}18`, color }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                    {title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {desc}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="ml-auto flex-shrink-0 mt-0.5 transition-transform"
                  style={{
                    color: 'var(--color-text-dim)',
                    transform: isActive ? 'rotate(90deg)' : 'none',
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Refund claim form (shown when Event Cancelled is selected) */}
        {activeCategory === 'cancelled' && (
          <div
            className="rounded-xl border p-6 mb-8"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <h2 className="font-semibold text-lg mb-5" style={{ color: 'var(--color-text)' }}>
              Check Refund Status
            </h2>
            <form onSubmit={handleCheck} className="flex flex-col gap-4">
              <Input
                label="Ticket ID"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="TKT-XXXX-XXXX"
                required
              />
              <Input
                label="Refund Protection Code"
                value={refundCode}
                onChange={(e) => setRefundCode(e.target.value)}
                placeholder="RF-XXXX-XX"
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <Button type="submit" size="lg" fullWidth>
                Check Refund Status
              </Button>
            </form>

            {/* Claim status tracker */}
            {showTracker && (
              <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-sm font-medium mb-5" style={{ color: 'var(--color-text-muted)' }}>
                  Claim Status
                </p>
                <div className="flex items-start gap-0">
                  {claimSteps.map((step, i) => (
                    <div key={step.label} className="flex-1 flex flex-col items-center gap-2">
                      <div className="flex items-center w-full">
                        {i > 0 && (
                          <div
                            className="flex-1 h-0.5"
                            style={{ backgroundColor: claimSteps[i - 1].done ? 'var(--color-green)' : 'var(--color-border)' }}
                          />
                        )}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 relative"
                          style={{
                            backgroundColor: step.done ? 'var(--color-green)' : step.active ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
                            borderColor: step.done ? 'var(--color-green)' : step.active ? 'var(--color-purple)' : 'var(--color-border)',
                          }}
                        >
                          {step.done ? (
                            <CheckCircle size={14} color="#fff" />
                          ) : step.active ? (
                            <span
                              className="w-2.5 h-2.5 rounded-full animate-pulse"
                              style={{ backgroundColor: 'var(--color-purple)' }}
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: 'var(--color-border)' }}
                            />
                          )}
                        </div>
                        {i < claimSteps.length - 1 && (
                          <div
                            className="flex-1 h-0.5"
                            style={{ backgroundColor: step.done ? 'var(--color-green)' : 'var(--color-border)' }}
                          />
                        )}
                      </div>
                      <p
                        className="text-[10px] text-center leading-tight"
                        style={{ color: step.active ? 'var(--color-purple-light)' : 'var(--color-text-dim)' }}
                      >
                        {step.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FAQ */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>
              Refund Policy
            </h2>
          </div>
          {faqItems.map((item, i) => (
            <div key={i} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {item.q}
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    color: 'var(--color-text-dim)',
                    transform: openFaq === i ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    flexShrink: 0,
                  }}
                />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
