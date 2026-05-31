'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
          <Mail size={24} />
        </div>
        <h1 className="text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          Reset Password
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Enter your email and we&apos;ll send a reset link
        </p>
      </div>

      {sent ? (
        <div className="rounded-xl border p-6 text-center"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#10b98120' }}>
            <Mail size={20} style={{ color: '#10b981' }} />
          </div>
          <p className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Check your inbox</p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            If an account exists for <strong>{email}</strong>, you&apos;ll receive a password reset link shortly.
          </p>
          <Link href="/organizer/login">
            <Button variant="outline" fullWidth>Back to Login</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border p-6"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Button type="submit" size="lg" fullWidth disabled={loading || !email}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
          <p className="text-sm text-center mt-4" style={{ color: 'var(--color-text-muted)' }}>
            Remember your password?{' '}
            <Link href="/organizer/login" className="hover:underline" style={{ color: 'var(--color-purple-light)' }}>
              Sign in
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
