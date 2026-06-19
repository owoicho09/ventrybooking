'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Lock } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatNGN } from '@/lib/utils';

interface CartItem {
  eventId: string;
  tierId: string;
  quantity: number;
  tierName: string;
  eventName: string;
  eventDate: string;
  tierPrice: number;
}

export default function CheckoutPage() {
  const [email, setEmail]                     = useState('');
  const [buyerName, setBuyerName]             = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [cart, setCart]                       = useState<CartItem | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('ventry_cart');
    if (raw) {
      try { setCart(JSON.parse(raw)); } catch { /* ignore bad data */ }
    }
  }, []);

  const isFree     = (cart?.tierPrice ?? -1) === 0;
  const subtotal   = cart ? cart.tierPrice * cart.quantity : 0;
  const serviceFee = isFree ? 0 : 100;
  const total      = subtotal + serviceFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart) return;
    setError('');
    setLoading(true);
    try {
      if (isFree) {
        const res = await fetch('/api/checkout/free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: cart.eventId,
            tierId: cart.tierId,
            quantity: cart.quantity,
            buyerEmail: email.trim().toLowerCase(),
            buyerName: buyerName.trim(),
            marketingConsent,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to get your free ticket');
          return;
        }
        sessionStorage.removeItem('ventry_cart');
        window.location.href = `/ticket/${data.data.ticketId}`;
      } else {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: cart.eventId,
            tierId: cart.tierId,
            quantity: cart.quantity,
            buyerEmail: email.trim().toLowerCase(),
            buyerName: buyerName.trim(),
            marketingConsent,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to initialize payment');
          return;
        }
        window.location.href = data.data.authorizationUrl;
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!cart) {
    return (
      <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
        <PublicNav />
        <div className="pt-16 flex items-center justify-center min-h-screen px-4">
          <div className="text-center">
            <p className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>No ticket selected</p>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
              Go back and select your tickets before checking out.
            </p>
            <Link href="/events"><Button>Browse Events</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-16 flex items-center justify-center px-4 py-16 min-h-screen">
        <div className="w-full max-w-lg">
          {/* Order summary */}
          <div className="rounded-xl border p-5 mb-5"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h2 className="font-semibold text-sm uppercase tracking-wider mb-4"
              style={{ color: 'var(--color-text-dim)' }}>Order Summary</h2>
            <div className="mb-4">
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{cart.eventName}</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(cart.eventDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {cart.tierName} &times; {cart.quantity}
              </p>
            </div>

            <div className="flex flex-col gap-1.5 text-sm mb-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                <span style={{ color: 'var(--color-text)' }}>{isFree ? 'Free' : formatNGN(subtotal)}</span>
              </div>
              {!isFree && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-muted)' }}>Ventry service fee</span>
                  <span style={{ color: 'var(--color-text)' }}>{formatNGN(serviceFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span style={{ color: 'var(--color-text)' }}>Total</span>
                <span style={{ color: 'var(--color-text)' }}>{isFree ? 'Free' : formatNGN(total)}</span>
              </div>
            </div>

            {!isFree && (
              <p className="text-[10px] leading-snug mb-4" style={{ color: 'var(--color-text-dim)' }}>
                The &#x20A6;100 service fee is non-refundable under any circumstances. Only the base ticket price is refunded if an event is cancelled. Paystack deducts their 1.5% processing fee from the payment on their end &#x2014; this is not added to your total.
              </p>
            )}

            <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
              <Shield size={15} />
              {isFree ? 'Free ticket — no payment required' : 'Your payment is held in escrow until the event happens'}
            </div>
          </div>

          {/* Form */}
          <div className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h1 className="text-2xl font-bold mb-6"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
              {isFree ? 'Get Your Free Ticket' : 'Complete Your Order'}
            </h1>
            {error && (
              <div className="mb-4 rounded-lg px-4 py-3 text-sm border"
                style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                label="Your Name"
                value={buyerName}
                onChange={e => setBuyerName(e.target.value)}
                placeholder="Amara Okonkwo"
              />
              <Input
                label="Your Email Address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                helper="Your QR ticket will be sent here. You'll also use this to retrieve your ticket."
                required
              />

              {/* Marketing consent opt-in */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={e => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 flex-shrink-0 w-4 h-4 rounded accent-[var(--color-purple)]"
                />
                <span className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  I agree to receive updates and offers from the event organizer by email. You can unsubscribe at any time. (Optional)
                </span>
              </label>

              <Button type="submit" size="lg" fullWidth disabled={loading || !email}>
                {loading
                  ? (isFree ? 'Getting your ticket…' : 'Redirecting to Paystack…')
                  : (isFree ? 'Get Free Ticket' : `Pay ${formatNGN(total)}`)}
              </Button>
            </form>

            <div className="mt-5 flex flex-col gap-3">
              {!isFree && (
                <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
                  <Lock size={11} className="inline mr-1 -mt-0.5" />
                  You will be redirected to Paystack to complete payment securely.
                </p>
              )}
              <p className="text-xs text-center" style={{ color: 'var(--color-text-dim)' }}>
                <Link href="/retrieve" className="hover:underline" style={{ color: 'var(--color-text-muted)' }}>
                  Already have a ticket? Find it here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
