'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function OrganizerLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      window.location.href = '/organizer/dashboard';
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
            Organizer Sign In
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Welcome back. Sign in to your dashboard.
          </p>
        </div>

        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {error && (
            <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', border: '1px solid', color: 'var(--color-red)' }}>
              {error}
            </div>
          )}
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
