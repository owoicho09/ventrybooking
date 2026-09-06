'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, Mail, ShieldCheck, PartyPopper, User, ChevronRight } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Step = 'email' | 'otp' | 'name' | 'welcome';

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (step !== 'welcome') return;
    const t = setTimeout(() => { router.push('/account'); router.refresh(); }, 1400);
    return () => clearTimeout(t);
  }, [step, router]);

  const otp = digits.join('');

  const requestOtp = async () => {
    const res = await fetch('/api/buyer/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send code');
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);
    try {
      await requestOtp();
      setDigits(['', '', '', '']);
      setStep('otp');
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await requestOtp();
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  const handleDigit = (i: number, val: string) => {
    const ch = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch && i < 3) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      setDigits(pasted.split(''));
      inputRefs.current[3]?.focus();
    }
  };

  const handleVerify = async () => {
    if (otp.length < 4) { setError('Enter all 4 digits'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/buyer/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Verification failed. Please try again.');
        return;
      }
      if (data.data.needsFirstName) {
        setStep('name');
      } else if (data.data.hasOrders) {
        setStep('welcome');
      } else {
        router.push('/account');
        router.refresh();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/buyer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save your name');
        return;
      }
      router.push('/account');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep('email');
    setError('');
    setDigits(['', '', '', '']);
  };

  const icon = step === 'email' ? <LogIn size={24} />
    : step === 'otp' ? <ShieldCheck size={24} />
    : step === 'name' ? <User size={24} />
    : <PartyPopper size={24} />;

  const title = step === 'email' ? 'Sign In'
    : step === 'otp' ? "Confirm It's You"
    : step === 'name' ? "What's your name?"
    : 'We found your tickets!';

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-16 flex items-center justify-center px-4 py-20 min-h-screen">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
              {icon}
            </div>
            <h1 className="text-3xl font-bold mb-2"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
              {title}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {step === 'email' && "Enter your email and we'll send you a code — no password needed."}
              {step === 'otp' && <>We sent a 4-digit code to <strong style={{ color: 'var(--color-text)' }}>{email}</strong></>}
              {step === 'name' && "So we know what to call you — takes two seconds."}
              {step === 'welcome' && 'Taking you to your tickets…'}
            </p>
          </div>

          {step !== 'welcome' && (
            <div className="rounded-xl border p-6"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              {error && (
                <div className="mb-4 rounded-lg px-4 py-3 text-sm border"
                  style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
                  {error}
                </div>
              )}

              {step === 'email' && (
                <form onSubmit={handleSendCode} className="flex flex-col gap-5">
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
                    {loading ? 'Sending code...' : 'Continue'}
                  </Button>
                  <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
                    Every order you&apos;ve made with this email — past and future — shows up here automatically.
                  </p>
                </form>
              )}

              {step === 'otp' && (
                <div className="flex flex-col gap-5">
                  <div className="flex gap-2 justify-center" onPaste={handlePaste}>
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
                        className="w-14 h-16 text-center text-2xl font-bold rounded-lg border-2 outline-none transition-colors"
                        style={{
                          backgroundColor: 'var(--color-surface-2)',
                          borderColor: d ? 'var(--color-purple)' : 'var(--color-border)',
                          color: 'var(--color-text)',
                        }}
                      />
                    ))}
                  </div>

                  <Button size="lg" fullWidth onClick={handleVerify} disabled={loading || otp.length < 4}>
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <button type="button" onClick={handleChangeEmail} className="transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={cooldown > 0 || resending}
                      className="font-medium transition-colors"
                      style={{ color: cooldown > 0 ? 'var(--color-text-dim)' : 'var(--color-purple-light)', cursor: cooldown > 0 ? 'default' : 'pointer' }}
                    >
                      {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </button>
                  </div>
                </div>
              )}

              {step === 'name' && (
                <form onSubmit={handleSaveName} className="flex flex-col gap-5">
                  <Input
                    label="First Name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Chidi"
                    icon={<User size={15} />}
                    autoFocus
                    required
                  />
                  <Button type="submit" size="lg" fullWidth disabled={!firstName.trim() || loading}>
                    {loading ? 'Saving...' : 'Continue'}
                  </Button>
                </form>
              )}

              {step === 'email' && (
                <>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>or</span>
                    <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      href="/organizer/login"
                      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:border-[var(--color-purple)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      <span>I&apos;m an organiser → Sign in to your dashboard</span>
                      <ChevronRight size={15} />
                    </Link>
                    <Link
                      href="/affiliate/login"
                      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:border-[var(--color-purple)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      <span>I&apos;m an affiliate → Sign in</span>
                      <ChevronRight size={15} />
                    </Link>
                  </div>
                </>
              )}

              {(step === 'email' || step === 'otp') && (
                <div className="mt-5 pt-5 border-t text-sm text-center"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                  Just need one ticket?{' '}
                  <Link href="/retrieve" className="hover:underline" style={{ color: 'var(--color-purple-light)' }}>
                    Retrieve without an account
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
