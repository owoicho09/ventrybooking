'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { readRefundPolicy, describeRefundPolicy, MINIMUM_STANDARDS } from '@/lib/refundPolicy';
import { Shield, Lock } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatNGN } from '@/lib/utils';
import { buyerTotalForItems } from '@/lib/fees';
import { suggestEmailFix } from '@/lib/emailTypos';

interface CartLine {
  tierId: string;
  tierName: string;
  tierPrice: number;
  quantity: number;
  /** Promo code that unlocked a code-gated tier on the event page (054). */
  accessCode?: string;
  /** Tier-level email gate (054), on top of the event-wide one. */
  allowedEmailDomains?: string[] | null;
}

interface Cart {
  eventId: string;
  eventName: string;
  eventDate: string;
  items: CartLine[];
  ref?: string;
  allowedEmailDomains?: string[] | null;
  /** The event's published refund policy (absent on carts saved before it existed). */
  refundPolicy?: unknown;
  organizerName?: string | null;
  eventSlug?: string | null;
  /** The event advertises prices before fees (060): itemise the service fee. */
  priceBeforeFees?: boolean;
  /** The event's buyer share of Ventry's fee (062); absent/null = pre-split event. Display only: the server charges its own figure. */
  buyerFeeRate?: number | null;
}

export default function CheckoutPage() {
  const [email, setEmail]                     = useState('');
  const [buyerName, setBuyerName]             = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  // Set when checkout says the promo code no longer works (e.g. the organiser
  // switched it off after the buyer unlocked the ticket): send them back to re-enter one.
  const [codeRejected, setCodeRejected]       = useState(false);
  const [cart, setCart]                       = useState<Cart | null>(null);
  // The signed-in buyer's own email, captured once and never mutated by
  // editing the email field below; if they change it to buy for a friend,
  // the ticket goes to the typed email (that email owns it, per platform
  // rule) but the order still needs to be attributable back to this session.
  const [sessionEmail, setSessionEmail]       = useState<string | null>(null);

  // Email confirmation. Before an order is created the buyer sees the exact
  // address the ticket will go to and confirms it (with a "did you mean" for
  // common domain typos). This replaced an emailed code, which caught the same
  // mistakes but cost real drop-off.
  const [step, setStep]                       = useState<'details' | 'confirm'>('details');

  useEffect(() => {
    const raw = sessionStorage.getItem('ventry_cart');
    if (raw) {
      try { setCart(JSON.parse(raw)); } catch { /* ignore bad data */ }
    }
  }, []);

  // Convenience pre-fill for a logged-in buyer session; guest checkout
  // (no session) is completely unaffected, and this never blocks submission.
  useEffect(() => {
    fetch('/api/buyer/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.data?.email) {
          setEmail(prev => prev || d.data.email);
          setSessionEmail(d.data.email);
        }
      })
      .catch(() => {});
  }, []);

  const { subtotal, serviceFee, processingFee, total } = cart
    ? buyerTotalForItems(cart.items.map(i => ({ price: i.tierPrice, quantity: i.quantity })), cart.buyerFeeRate)
    : { subtotal: 0, serviceFee: 0, processingFee: 0, total: 0 };
  const isFree = total === 0;

  const restrictedDomains = cart?.allowedEmailDomains ?? null;
  const emailDomain = email.trim().toLowerCase().split('@')[1];
  const eventDomainBlocked = !!restrictedDomains?.length && !!email && !restrictedDomains.includes(emailDomain || '');
  // The ticket's own email gate, if any (the event-wide one above still applies too).
  const tierGate = cart?.items.find(i => i.allowedEmailDomains?.length && !i.allowedEmailDomains.includes(emailDomain || '')) ?? null;
  const tierDomainBlocked = !!email && !!tierGate;
  const domainBlocked = eventDomainBlocked || tierDomainBlocked;
  const domainMessage = eventDomainBlocked
    ? `This event is restricted to ${restrictedDomains!.map(d => `@${d}`).join(' or ')} email addresses.`
    : tierGate
      ? `${tierGate.tierName} is only for ${tierGate.allowedEmailDomains!.map(d => `@${d}`).join(' or ')} email addresses.`
      : '';

  const normalizedEmail = email.trim().toLowerCase();
  const emailSuggestion = suggestEmailFix(normalizedEmail);
  // A signed-in buyer keeping their own account email has nothing to confirm.
  const needsConfirm = !(sessionEmail && sessionEmail.toLowerCase() === normalizedEmail);

  // Creates the order (free) or the Flutterwave session (paid). Only ever called
  // once the buyer has confirmed the email.
  const placeOrder = async () => {
    if (!cart) return;
    const endpoint = isFree ? '/api/checkout/free' : '/api/checkout';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: cart.eventId,
        items: cart.items.map(i => ({ tierId: i.tierId, quantity: i.quantity, accessCode: i.accessCode })),
        buyerEmail: normalizedEmail,
        buyerName: buyerName.trim(),
        // One box consents to both lists: the organiser's Audience and Ventry's own.
        marketingConsent,
        ventryMarketingConsent: marketingConsent,
        ref: cart.ref,
        purchasedByEmail: sessionEmail,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === 'ACCESS_CODE_INVALID' || data.code === 'ACCESS_CODE_REQUIRED') {
        // Forget the stale code, both in this cart and on the event page, so
        // the ticket shows as locked again and asks for a fresh code.
        try {
          const key = `ventry_codes_${cart.eventId}`;
          const saved = JSON.parse(sessionStorage.getItem(key) || '{}') as Record<string, string>;
          for (const i of cart.items) delete saved[i.tierId];
          sessionStorage.setItem(key, JSON.stringify(saved));
          const stripped = { ...cart, items: cart.items.map(i => ({ ...i, accessCode: undefined })) };
          sessionStorage.setItem('ventry_cart', JSON.stringify(stripped));
        } catch { /* storage unavailable */ }
        setCodeRejected(true);
      }
      setStep('details');
      setError(data.error || (isFree ? 'Failed to get your free ticket' : 'Failed to initialize payment'));
      return;
    }
    if (isFree) {
      sessionStorage.removeItem('ventry_cart');
      window.location.href = `/ticket/${data.data.ticketId}?new=1`;
    } else {
      window.location.href = data.data.authorizationUrl;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart) return;
    setError('');
    setCodeRejected(false);
    if (domainBlocked) {
      setError(domainMessage);
      return;
    }
    if (needsConfirm) {
      setStep('confirm');
      return;
    }
    await submitOrder();
  };

  const submitOrder = async () => {
    setError('');
    setLoading(true);
    try {
      await placeOrder();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseSuggestion = () => {
    if (emailSuggestion) setEmail(emailSuggestion);
  };

  const handleChangeEmail = () => {
    setStep('details');
    setError('');
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
              <div className="flex flex-col gap-0.5">
                {cart.items.map(item => (
                  <p key={item.tierId} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {item.tierName} &times; {item.quantity}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-sm mb-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Ticket price</span>
                <span style={{ color: 'var(--color-text)' }}>{isFree ? 'Free' : formatNGN(subtotal)}</span>
              </div>
              {!isFree && serviceFee > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-muted)' }}>Service fee</span>
                  <span style={{ color: 'var(--color-text)' }}>{formatNGN(serviceFee)}</span>
                </div>
              )}
              {!isFree && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-muted)' }}>Processing fee</span>
                  <span style={{ color: 'var(--color-text)' }}>{formatNGN(processingFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span style={{ color: 'var(--color-text)' }}>Total</span>
                <span style={{ color: 'var(--color-text)' }}>{isFree ? 'Free' : formatNGN(total)}</span>
              </div>
            </div>

            {(() => {
              const policy = readRefundPolicy(cart.refundPolicy);
              const href = cart.eventSlug ? `/${cart.eventSlug}#refund-policy` : null;
              return (
                <div className="rounded-lg border p-3 mb-4 text-xs leading-relaxed"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                  <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                    Refund policy{cart.organizerName ? ` - set by ${cart.organizerName}` : ''}
                  </p>
                  {policy ? (
                    <ul className="flex flex-col gap-1" style={{ color: 'var(--color-text-muted)' }}>
                      {describeRefundPolicy(policy, cart.organizerName ?? '').map(s => (
                        <li key={s.title}><span style={{ color: 'var(--color-text)' }}>{s.title}:</span> {s.text}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)' }}>{MINIMUM_STANDARDS.join(' ')}</p>
                  )}
                  <p className="mt-1.5" style={{ color: 'var(--color-text-dim)' }}>
                    Refunds are paid by the organiser, not Ventry. Changing your mind is not grounds for a refund.
                    {href && <> <Link href={href} className="underline">Full policy</Link></>}
                  </p>
                </div>
              );
            })()}

            {!isFree && (
              <p className="text-[10px] leading-snug mb-4" style={{ color: 'var(--color-text-dim)' }}>
                The service fee and processing fee are non-refundable.
              </p>
            )}

            <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
              <Shield size={15} />
              {isFree ? 'Free ticket - no payment required' : 'Secure payment - your ticket is issued immediately'}
            </div>
          </div>

          {/* Form */}
          <div className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h1 className="text-2xl font-bold mb-6"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
              {step === 'confirm' ? 'Is Your Email Correct?' : isFree ? 'Get Your Free Ticket' : 'Complete Your Order'}
            </h1>
            {error && (
              <div className="mb-4 rounded-lg px-4 py-3 text-sm border"
                style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
                {error}
                {codeRejected && (
                  <div className="mt-2">
                    <a href={cart.eventSlug ? `/${cart.eventSlug}#tickets` : `/events/${cart.eventId}`} className="font-semibold underline">
                      Go back and enter your code again
                    </a>
                  </div>
                )}
              </div>
            )}
            {step === 'confirm' ? (
            <div className="flex flex-col gap-5">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Your ticket will be sent to:
              </p>
              <div className="rounded-lg border px-4 py-3 text-center"
                style={{ borderColor: 'var(--color-purple)', backgroundColor: 'var(--color-purple-dim)' }}>
                <p className="text-lg font-semibold" style={{ color: 'var(--color-text)', wordBreak: 'break-all' }}>
                  {normalizedEmail}
                </p>
              </div>
              {emailSuggestion && (
                <div className="rounded-lg border px-4 py-3 text-sm"
                  style={{ backgroundColor: '#f59e0b15', borderColor: '#f59e0b40', color: 'var(--color-text)' }}>
                  Did you mean <strong style={{ wordBreak: 'break-all' }}>{emailSuggestion}</strong>?{' '}
                  <button type="button" onClick={handleUseSuggestion} className="font-semibold underline">
                    Use this instead
                  </button>
                </div>
              )}
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Please check it carefully. Your QR ticket is emailed here, and you&apos;ll need this exact address to
                find your ticket later. We can&apos;t move a ticket sent to a mistyped email.
              </p>
              <Button type="button" size="lg" fullWidth onClick={submitOrder} disabled={loading}>
                {loading
                  ? (isFree ? 'Getting your ticket…' : 'Redirecting to payment…')
                  : isFree ? 'Yes, Get Free Ticket' : `Yes, Pay ${formatNGN(total)}`}
              </Button>
              <Button type="button" size="lg" variant="outline" fullWidth onClick={handleChangeEmail} disabled={loading}>
                No, change email
              </Button>
            </div>
            ) : (
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
                helper={
                  restrictedDomains?.length
                    ? `Restricted event - only ${restrictedDomains.map(d => `@${d}`).join(' or ')} email addresses can buy.`
                    : cart.items.some(i => i.allowedEmailDomains?.length)
                      ? `${cart.items.find(i => i.allowedEmailDomains?.length)!.tierName} is only for ${cart.items.find(i => i.allowedEmailDomains?.length)!.allowedEmailDomains!.map(d => `@${d}`).join(' or ')} email addresses. The ticket is sent here.`
                    : sessionEmail
                      ? "Your QR ticket will be sent here. You'll also use this to retrieve your ticket."
                      : "Your QR ticket will be sent here. Double-check it, as this is the only way to receive your ticket."
                }
                required
              />
              {domainBlocked && (
                <p className="text-xs -mt-3" style={{ color: 'var(--color-red)' }}>
                  {domainMessage}
                </p>
              )}
              {!domainBlocked && emailSuggestion && (
                <p className="text-xs -mt-3" style={{ color: '#f59e0b' }}>
                  Did you mean{' '}
                  <button type="button" onClick={handleUseSuggestion} className="font-semibold underline" style={{ wordBreak: 'break-all' }}>
                    {emailSuggestion}
                  </button>?
                </p>
              )}

              {/* Optional marketing consent: one unticked box covering both the
                  organiser's Audience and Ventry's list. Deliberately boxed off from
                  the terms statement below so it never reads as part of agreeing. */}
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--color-border)' }}>
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={e => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 flex-shrink-0 w-4 h-4 rounded accent-[var(--color-purple)]"
                />
                <span className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  I&apos;d like to receive event updates and offers from this organiser and from Ventry. You can unsubscribe at any time.
                  <span className="block mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Optional</span>
                </span>
              </label>

              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
                By {isFree ? 'getting this ticket' : 'purchasing'} you agree to Ventry&apos;s{' '}
                <Link href="/terms/buyers" className="underline" style={{ color: 'var(--color-text-muted)' }}>Buyer Terms of Use</Link>
                {' '}and this event&apos;s refund policy shown above.
              </p>

              <Button type="submit" size="lg" fullWidth disabled={loading || !email.trim() || domainBlocked}>
                {loading
                  ? (isFree ? 'Getting your ticket…' : 'Redirecting to payment…')
                  : needsConfirm
                    ? 'Continue'
                    : (isFree ? 'Get Free Ticket' : `Pay ${formatNGN(total)}`)}
              </Button>
            </form>
            )}

            <div className="mt-5 flex flex-col gap-3">
              {!isFree && (
                <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
                  <Lock size={11} className="inline mr-1 -mt-0.5" />
                  You will be redirected to our payment processor to complete payment securely.
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



