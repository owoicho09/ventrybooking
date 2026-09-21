'use client';

import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { StarPicker } from '@/components/events/StarPicker';

interface Props {
  eventId: string;
  /** Called after a review is posted so the page can refresh its list and average. */
  onSubmitted: () => void;
}

type Step = 'email' | 'code' | 'write' | 'done';

const MAX_BODY = 500;

// Buyers rate from the past event's own page: type the email they bought
// with, prove they can read it with a code, then write the review. The
// server sends a code only to an email that holds a ticket for this event,
// and never says which — so the copy below is deliberately "if".
export function ReviewForm({ eventId, onSubmitted }: Props) {
  const [step, setStep]           = useState<Step>('email');
  const [email, setEmail]         = useState('');
  const [code, setCode]           = useState('');
  const [codeLength, setCodeLength] = useState(6);
  const [token, setToken]         = useState('');
  const [rating, setRating]       = useState(0);
  const [body, setBody]           = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');
  const [notice, setNotice]       = useState('');
  const [cooldown, setCooldown]   = useState(0);

  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const post = async (path: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/events/${eventId}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  const sendCode = async (): Promise<boolean> => {
    const { ok, data } = await post('review-code', { email: normalizedEmail });
    if (!ok) { setError(data.error || 'Could not send a code. Please try again.'); return false; }
    setCooldown(data.data?.cooldownSeconds ?? 60);
    if (data.data?.codeLength) setCodeLength(data.data.codeLength);
    return true;
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      setCode('');
      if (await sendCode()) setStep('code');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  };

  const handleResend = async () => {
    if (cooldown > 0 || busy) return;
    setError(''); setNotice(''); setBusy(true);
    try {
      if (await sendCode()) { setCode(''); setNotice('We sent another code if that email bought a ticket for this event.'); }
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      const { ok, data } = await post('review-verify', { email: normalizedEmail, otp: code.trim() });
      if (!ok) { setError(data.error || 'Could not verify that code'); return; }
      setToken(data.data.reviewToken);
      setStep('write');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError('Please select a star rating first'); return; }
    setError(''); setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewToken: token, rating, body: body.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'REVIEW_NOT_VERIFIED') { setToken(''); setStep('email'); }
        setError(data.error || 'Failed to submit review');
        return;
      }
      setStep('done');
      onSubmitted();
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  };

  const goBackToEmail = () => { setStep('email'); setCode(''); setError(''); setNotice(''); };

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
      {step === 'done' ? (
        <div className="flex items-start gap-3">
          <CheckCircle size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-green)' }} />
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>Thanks, your review is posted.</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>It now appears in the list above.</p>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Were you at this event? Rate it</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Only people who bought a ticket can leave a review. We&apos;ll email you a code to confirm it&apos;s you.
            </p>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
          {notice && <p className="text-sm" style={{ color: 'var(--color-purple-light)' }}>{notice}</p>}

          {step === 'email' && (
            <form onSubmit={handleEmail} className="flex flex-col gap-3">
              <Input
                label="Email you bought your ticket with"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <Button type="submit" fullWidth disabled={busy || !email.trim()}>
                {busy ? 'Sending code…' : 'Send me a code'}
              </Button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleVerify} className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                If <strong style={{ color: 'var(--color-text)', wordBreak: 'break-all' }}>{normalizedEmail}</strong>{' '}
                was used to buy a ticket for this event, we&apos;ve sent it a {codeLength}-digit code.
              </p>
              <Input
                label="Verification code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, codeLength))}
                placeholder={'0'.repeat(codeLength)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={codeLength}
                autoFocus
                required
              />
              <Button type="submit" fullWidth disabled={busy || code.length !== codeLength}>
                {busy ? 'Checking…' : 'Verify'}
              </Button>
              <div className="rounded-lg border px-3 py-3 text-xs leading-relaxed" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Didn&apos;t get a code?</p>
                <p className="mb-3">
                  Make sure that&apos;s the exact email you used when you bought your ticket. A different or mistyped address
                  won&apos;t receive one. Also check your spam or promotions folder.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handleResend} disabled={cooldown > 0 || busy}>
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={goBackToEmail} disabled={busy}>
                    Use a different email
                  </Button>
                </div>
              </div>
            </form>
          )}

          {step === 'write' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <StarPicker value={rating} onChange={setRating} />
              <div className="flex flex-col gap-1">
                <Textarea
                  placeholder="Share your experience… (optional)"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={4}
                  maxLength={MAX_BODY}
                />
                {body.length > 0 && (
                  <p className="text-xs text-right" style={{ color: 'var(--color-text-dim)' }}>{body.length}/{MAX_BODY}</p>
                )}
              </div>
              <Button type="submit" fullWidth disabled={busy || rating === 0}>
                {busy ? 'Posting…' : 'Post Review'}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
