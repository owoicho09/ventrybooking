'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Mail } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function RetrievePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId || !email) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/tickets/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticketId.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Ticket not found. Please check your details and try again.');
        return;
      }
      router.push(`/ticket/${data.data.id}`);
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
              Find Your Ticket
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Enter your email and Ticket ID to retrieve your QR code
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

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Ticket ID
                </label>
                <input
                  type="text"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value.toUpperCase())}
                  placeholder="TKT-XXXX-XXXX"
                  required
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--color-purple)] focus:ring-1 focus:ring-[var(--color-purple)] placeholder:text-[var(--color-text-dim)] tracking-widest"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                  }}
                />
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Your Ticket ID was included in your confirmation email
                </p>
              </div>

              <Button type="submit" size="lg" fullWidth disabled={!email || !ticketId || loading}>
                {loading ? 'Searching...' : 'Find Ticket'}
              </Button>
            </form>

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
