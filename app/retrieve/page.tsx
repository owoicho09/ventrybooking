'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Mail } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatShortDate } from '@/lib/utils';

interface FoundTicket {
  id: string;
  status: string;
  eventName: string;
  eventDate: string;
}

export default function RetrievePage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState<FoundTicket[] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    setTickets(null);
    setLoading(true);
    try {
      const res = await fetch('/api/tickets/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'No tickets found. Please check your email and try again.');
        return;
      }
      setTickets(data.data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-16 flex items-center justify-center px-4 py-20 min-h-screen">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
              <Search size={24} />
            </div>
            <h1 className="text-3xl font-bold mb-2"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
              Find Your Tickets
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Enter the email you used at checkout to find your tickets
            </p>
          </div>

          <div className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            {error && (
              <div className="mb-4 rounded-lg px-4 py-3 text-sm border"
                style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                icon={<Mail size={15} />}
                required
              />

              <Button type="submit" size="lg" fullWidth disabled={!email || loading}>
                {loading ? 'Searching...' : 'Find My Tickets'}
              </Button>
            </form>

            {tickets && tickets.length > 0 && (
              <div className="mt-5 pt-5 border-t flex flex-col gap-2" style={{ borderColor: 'var(--color-border)' }}>
                {tickets.map(t => (
                  <Link
                    key={t.id}
                    href={`/ticket/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-colors hover:border-[var(--color-purple)]"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{t.eventName}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {t.eventDate ? formatShortDate(t.eventDate) : ''} &middot; {t.id}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded"
                      style={{
                        color: t.status === 'valid' ? 'var(--color-green)' : 'var(--color-text-dim)',
                        backgroundColor: t.status === 'valid' ? 'var(--color-green)15' : 'var(--color-surface)',
                      }}
                    >
                      {t.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-5 pt-5 border-t text-sm text-center"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              Need help?{' '}
              <Link href="/help" className="hover:underline" style={{ color: 'var(--color-purple-light)' }}>
                Visit Help Center
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
