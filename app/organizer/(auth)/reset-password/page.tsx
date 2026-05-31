'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Reset failed'); return; }
      setDone(true);
      setTimeout(() => router.push('/organizer/login'), 2000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <div className="text-center p-6">
      <p style={{ color: 'var(--color-red)' }}>Invalid or missing reset token.</p>
      <Link href="/organizer/forgot-password" className="text-sm mt-4 block" style={{ color: 'var(--color-purple-light)' }}>
        Request a new link
      </Link>
    </div>
  );

  return (
    <div className="rounded-xl border p-6"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      {done ? (
        <div className="text-center">
          <p className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Password updated!</p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Redirecting to login...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm border"
              style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
              {error}
            </div>
          )}
          <Input label="New Password" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
          <Input label="Confirm Password" type="password" value={confirm}
            onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
          <Button type="submit" size="lg" fullWidth disabled={loading || !password || !confirm}>
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
          <Lock size={24} />
        </div>
        <h1 className="text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          New Password
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Choose a strong password for your account
        </p>
      </div>
      <Suspense fallback={<div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
