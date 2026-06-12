'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    fetch('/api/organizer/me')
      .then(r => r.json())
      .then(d => {
        if (d.data?.verified) { router.replace('/organizer/dashboard'); return; }
        if (d.data?.email) setEmail(d.data.email);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const otp = digits.join('');

  const handleDigit = (i: number, val: string) => {
    const ch = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    if (otp.length < 6) { setError('Enter all 6 digits'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/organizer/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Verification failed'); return; }
      router.push('/organizer/dashboard');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const res = await fetch('/api/organizer/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not resend'); return; }
      setCooldown(60);
    } catch { setError('Network error. Please try again.'); }
    finally { setResending(false); }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="border-b h-16 flex items-center px-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <Link href="/" className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
          <span style={{ color: 'var(--color-purple)' }}>V</span>
          <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border p-8" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-purple-dim)' }}>
                <Mail size={24} style={{ color: 'var(--color-purple)' }} />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
                Check your email
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                We sent a 6-digit code to{' '}
                {email
                  ? <strong style={{ color: 'var(--color-text)' }}>{email}</strong>
                  : 'your email address'
                }
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-lg px-4 py-3 text-sm border" style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-11 h-14 text-center text-xl font-bold rounded-lg border-2 outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    borderColor: d ? 'var(--color-purple)' : 'var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
              ))}
            </div>

            <Button size="lg" fullWidth onClick={handleVerify} disabled={loading || otp.length < 6}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </Button>

            <div className="mt-5 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Didn&apos;t receive it?{' '}
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className="font-medium transition-colors"
                style={{ color: cooldown > 0 ? 'var(--color-text-dim)' : 'var(--color-purple-light)', cursor: cooldown > 0 ? 'default' : 'pointer' }}
              >
                {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
