'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type SignedIn = { emailVerified?: boolean };

export default function OrganizerLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // New-device step (057): set when the password was right but this browser
  // isn't trusted yet, so an emailed code is needed to finish signing in.
  const [challenge, setChallenge] = useState<{ id: string; sentTo: string } | null>(null);
  const [code, setCode] = useState('');

  const goIn = (data: SignedIn) => {
    if (!data?.emailVerified) {
      window.location.href = '/organizer/verify';
      return;
    }
    const returnTo = new URLSearchParams(window.location.search).get('return');
    // Accept only same-origin paths: must start with / but not // or /\
    // The /[^/\\] prefix blocks protocol-relative and backslash-normalised redirects.
    const safe = returnTo && /^\/[^/\\]/.test(returnTo);
    window.location.href = safe ? returnTo : '/organizer/dashboard';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/organizer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      if (data.data?.needsDeviceCode) {
        setChallenge({ id: data.data.challengeId, sentTo: data.data.sentTo });
        setCode('');
        setLoading(false);
        return;
      }
      goIn(data.data);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/organizer/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.id, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'That code didn’t work');
        setLoading(false);
        return;
      }
      goIn(data.data);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight inline-block mb-6"
            style={{ fontFamily: 'var(--font-syne), sans-serif' }}
          >
            <span style={{ color: 'var(--color-purple)' }}>V</span>
            <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            {challenge ? 'Confirm it’s you' : 'Organizer Sign In'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {challenge ? 'You’re signing in on a new device.' : 'Welcome back. Sign in to your dashboard.'}
          </p>
        </div>

        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {error && (
            <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', border: '1px solid', color: 'var(--color-red)' }}>
              {error}
            </div>
          )}

          {!challenge ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required />

              <div className="text-right">
                <Link href="/organizer/forgot-password" className="text-xs hover:underline" style={{ color: 'var(--color-text-muted)' }}>
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" size="lg" fullWidth disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-purple-light)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  For your security we emailed a 6-digit code to <strong style={{ color: 'var(--color-text)' }}>{challenge.sentTo}</strong>.
                  Enter it to finish signing in. You&apos;ll only need to do this once on this device.
                </p>
              </div>
              <input
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000" aria-label="6-digit sign-in code"
                className="w-full rounded-lg border px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none"
                style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
              <Button type="submit" size="lg" fullWidth disabled={loading || code.length !== 6}>
                {loading ? 'Checking...' : 'Confirm and sign in'}
              </Button>
              <div className="flex justify-between text-xs">
                <button type="button" className="hover:underline" style={{ color: 'var(--color-text-muted)' }}
                  disabled={loading} onClick={() => handleSubmit({ preventDefault() {} } as React.FormEvent)}>
                  Send a new code
                </button>
                <button type="button" className="hover:underline" style={{ color: 'var(--color-text-muted)' }}
                  onClick={() => { setChallenge(null); setCode(''); setError(''); }}>
                  Use a different account
                </button>
              </div>
            </form>
          )}

          <p className="text-sm text-center mt-5 pt-5 border-t" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/organizer/register" className="font-medium hover:underline" style={{ color: 'var(--color-purple-light)' }}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
