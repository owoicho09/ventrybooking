'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Lock } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatNGN } from '@/lib/utils';
import { buyerTotalForItems } from '@/lib/fees';

interface CartLine {
  tierId: string;
  tierName: string;
  tierPrice: number;
  quantity: number;
}

interface Cart {
  eventId: string;
  eventName: string;
  eventDate: string;
  items: CartLine[];
  ref?: string;
  allowedEmailDomains?: string[] | null;
}

export default function CheckoutPage() {
  const [email, setEmail]                     = useState('');
  const [buyerName, setBuyerName]             = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [cart, setCart]                       = useState<Cart | null>(null);
  // The signed-in buyer's own email, captured once and never mutated by
  // editing the email field below — if they change it to buy for a friend,
  // the ticket goes to the typed email (that email owns it, per platform
  // rule) but the order still needs to be attributable back to this session.
  const [sessionEmail, setSessionEmail]       = useState<string | null>(null);

  // Email verification. A guest must prove they can read the inbox they typed
  // before an order is created, which catches typos like "gmil.com" up front.
  // The token is bound to the exact email it was issued for, so editing the
  // email afterwards invalidates it (see needsVerification below).
  const [step, setStep]                       = useState<'details' | 'verify'>('details');
  const [otp, setOtp]                         = useState('');
  const [emailToken, setEmailToken]           = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail]     = useState<string | null>(null);
  const [codeLength, setCodeLength]           = useState(6);
  const [cooldown, setCooldown]               = useState(0);
  const [resending, setResending]             = useState(false);
  const [notice, setNotice]                   = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('ventry_cart');
    if (raw) {
      try { setCart(JSON.parse(raw)); } catch { /* ignore bad data */ }
    }
  }, []);

  // Convenience pre-fill for a logged-in buyer session — guest checkout
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

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const { subtotal, serviceFee, processingFee, total } = cart
    ? buyerTotalForItems(cart.items.map(i => ({ price: i.tierPrice, quantity: i.quantity })))
    : { subtotal: 0, serviceFee: 0, processingFee: 0, total: 0 };
  const isFree = total === 0;

  const restrictedDomains = cart?.allowedEmailDomains ?? null;
  const emailDomain = email.trim().toLowerCase().split('@')[1];
  const domainBlocked = !!restrictedDomains?.length && !!email && !restrictedDomains.includes(emailDomain || '');

  const normalizedEmail = email.trim().toLowerCase();
  // A signed-in buyer is already verified server-side; guests need a token
  // issued for exactly the email currently in the field.
  const needsVerification = !sessionEmail && !(emailToken && verifiedEmail === normalizedEmail);

  // Returns true once a code is on its way (including "one was just sent" —
  // the server's resend cooldown answers 429 with retryAfter in that case).
  const sendCode = async (): Promise<boolean> => {
    const res = await fetch('/api/checkout/email-otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCooldown(data.data?.cooldownSeconds ?? 60);
      if (data.data?.codeLength) setCodeLength(data.data.codeLength);
      return true;
    }
    if (res.status === 429 && typeof data.retryAfter === 'number') {
      setCooldown(data.retryAfter);
      return true;
    }
    setError(data.error || 'Could not send a code. Please try again.');
    return false;
  };

  // Creates the order (free) or the Paystack session (paid). Only ever called
  // once the email is verified; the server re-checks the token regardless.
  const placeOrder = async (token: string | null) => {
    if (!cart) return;
    const endpoint = isFree ? '/api/checkout/free' : '/api/checkout';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: cart.eventId,
        items: cart.items.map(i => ({ tierId: i.tierId, quantity: i.quantity })),
        buyerEmail: normalizedEmail,
        buyerName: buyerName.trim(),
        // One box consents to both lists — the organiser's Audience and Ventry's own.
        marketingConsent,
        ventryMarketingConsent: marketingConsent,
        ref: cart.ref,
        purchasedByEmail: sessionEmail,
        emailToken: token,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === 'EMAIL_NOT_VERIFIED') {
        // Token expired or was rejected: start verification over.
        setEmailToken(null);
        setVerifiedEmail(null);
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
    setNotice('');
    if (domainBlocked) {
      setError(`This event is restricted to ${restrictedDomains!.map(d => `@${d}`).join(' or ')} email addresses.`);
      return;
    }
    setLoading(true);
    try {
      if (needsVerification) {
        setOtp('');
        if (await sendCode()) setStep('verify');
        return;
      }
      await placeOrder(emailToken);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const res = await fetch('/api/checkout/email-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not verify that code');
        return;
      }
      const token: string = data.data.emailToken;
      setEmailToken(token);
      setVerifiedEmail(normalizedEmail);
      // Verified: carry straight on into the purchase, no second click.
      await placeOrder(token);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError('');
    setNotice('');
    setResending(true);
    try {
      if (await sendCode()) {
        setOtp('');
        setNotice(`A new code was sent to ${normalizedEmail}.`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = () => {
    setStep('details');
    setOtp('');
    setError('');
    setNotice('');
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
                <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                <span style={{ color: 'var(--color-text)' }}>{isFree ? 'Free' : formatNGN(subtotal)}</span>
              </div>
              {!isFree && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-muted)' }}>Ventry service fee</span>
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

            {!isFree && (
              <p className="text-[10px] leading-snug mb-4" style={{ color: 'var(--color-text-dim)' }}>
                The service fee (2%, capped at ₦3,000 per ticket for tickets above ₦150,000) and processing fee are non-refundable under any circumstances.
              </p>
            )}

            <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
              <Shield size={15} />
              {isFree ? 'Free ticket — no payment required' : 'Secure payment — your ticket is issued immediately'}
            </div>
          </div>

          {/* Form */}
          <div className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h1 className="text-2xl font-bold mb-6"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
              {step === 'verify' ? 'Confirm Your Email' : isFree ? 'Get Your Free Ticket' : 'Complete Your Order'}
            </h1>
            {error && (
              <div className="mb-4 rounded-lg px-4 py-3 text-sm border"
                style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
                {error}
              </div>
            )}
            {notice && (
              <div className="mb-4 rounded-lg px-4 py-3 text-sm border"
                style={{ backgroundColor: 'var(--color-purple-dim)', borderColor: 'var(--color-border)', color: 'var(--color-purple-light)' }}>
                {notice}
              </div>
            )}
            {step === 'verify' ? (
            <form onSubmit={handleVerify} className="flex flex-col gap-5">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                We sent a {codeLength}-digit code to{' '}
                <strong style={{ color: 'var(--color-text)', wordBreak: 'break-all' }}>{normalizedEmail}</strong>.
                {' '}Enter it below to {isFree ? 'get your ticket' : 'continue to payment'}.
              </p>
              <Input
                label="Verification code"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, codeLength))}
                placeholder={'0'.repeat(codeLength)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={codeLength}
                autoFocus
                required
              />
              <Button type="submit" size="lg" fullWidth disabled={loading || otp.length !== codeLength}>
                {loading ? 'Verifying…' : isFree ? 'Verify & Get Free Ticket' : `Verify & Pay ${formatNGN(total)}`}
              </Button>

              <div className="rounded-lg border px-4 py-3 text-xs leading-relaxed"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Didn&apos;t get the code?</p>
                <p className="mb-3">
                  Make sure <strong style={{ color: 'var(--color-text)', wordBreak: 'break-all' }}>{normalizedEmail}</strong>{' '}
                  is the email address you meant to enter. A typo is the most common reason. Also check your spam or
                  promotions folder. If it&apos;s wrong, change it; otherwise you can resend the code.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handleResend} disabled={cooldown > 0 || resending || loading}>
                    {resending ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={handleChangeEmail} disabled={loading}>
                    Change email
                  </Button>
                </div>
              </div>
            </form>
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
                    ? `Restricted event — only ${restrictedDomains.map(d => `@${d}`).join(' or ')} email addresses can buy.`
                    : sessionEmail
                      ? "Your QR ticket will be sent here. You'll also use this to retrieve your ticket."
                      : "Your QR ticket will be sent here. We'll email you a code to confirm it's correct before you continue."
                }
                required
              />
              {domainBlocked && (
                <p className="text-xs -mt-3" style={{ color: 'var(--color-red)' }}>
                  This email doesn&apos;t match an allowed domain for this event.
                </p>
              )}

              {/* Optional marketing consent — one unticked box covering both the
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
                <Link href="/terms/buyers" className="underline" style={{ color: 'var(--color-text-muted)' }}>Buyer Terms of Use</Link>.
              </p>

              <Button type="submit" size="lg" fullWidth disabled={loading || !email || domainBlocked}>
                {loading
                  ? (needsVerification ? 'Sending code…' : isFree ? 'Getting your ticket…' : 'Redirecting to payment…')
                  : needsVerification
                    ? 'Verify Email & Continue'
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
