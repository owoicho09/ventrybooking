'use client';

import { Mail, MessageCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';

const faqItems = [
  {
    q: 'How do I retrieve my ticket?',
    a: 'Visit ventry.com/retrieve and enter your email address. Your tickets will be sent to your inbox, or you can view them directly on the website.',
  },
  {
    q: 'My QR code is not scanning. What do I do?',
    a: 'Try increasing your screen brightness and ensure the QR code is fully visible. You can also show your Ticket ID to the event staff as an alternative.',
  },
  {
    q: 'I was charged but did not receive a ticket.',
    a: 'Check your spam/junk folder first. If still not found, visit ventry.com/retrieve with the email used at checkout. If the issue persists, contact support at hello@ventry.com with your payment reference.',
  },
  {
    q: 'Will I get a refund if an event is cancelled?',
    a: 'Yes. If an organizer cancels an event through Ventry, all buyers receive an automatic refund of the base ticket price within 3-5 business days. The ₦100 Ventry service fee is non-refundable.',
  },
  {
    q: 'How do I report a suspicious or fraudulent event?',
    a: 'Email hello@ventry.com with the event name and your concerns. Our team reviews all reports within 24 hours.',
  },
  {
    q: 'Can I get a refund if I change my mind?',
    a: 'No. Ventry tickets are non-refundable for buyer change of mind. Refunds only apply when an event is cancelled or flagged as fraudulent by Ventry.',
  },
];

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />
      <div className="pt-16 max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1
            className="text-4xl font-bold mb-3"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
          >
            Help &amp; Support
          </h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Need help? Check the FAQ below or reach out directly.
          </p>
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <div
            className="rounded-xl border p-5 flex items-start gap-4"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}
            >
              <Mail size={18} />
            </div>
            <div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--color-text)' }}>Email Support</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>hello@ventry.com</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>We respond within 24 hours</p>
            </div>
          </div>

          <div
            className="rounded-xl border p-5 flex items-start gap-4"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}
            >
              <MessageCircle size={18} />
            </div>
            <div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--color-text)' }}>Ticket Retrieval</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <a href="/retrieve" className="hover:underline" style={{ color: 'var(--color-purple-light)' }}>
                  ventry.com/retrieve
                </a>
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>Find your ticket instantly</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>
              Frequently Asked Questions
            </h2>
          </div>
          {faqItems.map((item, i) => (
            <div key={i} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="text-sm font-medium pr-4" style={{ color: 'var(--color-text)' }}>
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
