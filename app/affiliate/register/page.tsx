'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LEGAL_VERSIONS } from '@/lib/legalVersions';

export default function AffiliateRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/affiliate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, termsVersion: LEGAL_VERSIONS.affiliatePolicy.version }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); return; }
      router.push('/affiliate/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold tracking-tight inline-block mb-6" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
            <span style={{ color: 'var(--color-purple)' }}>V</span>
            <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            Become a Ventry Affiliate
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Refer organisers, earn 30% of Ventry&apos;s service fee on their first two events.
          </p>
        </div>

        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {error && (
            <div className="mb-4 rounded-lg px-4 py-3 text-sm border" style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full Name" value={form.name} onChange={set('name')} placeholder="Amaka Eze" required />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
            <Input label="Password" type="password" value={form.password} onChange={set('password')} placeholder="Create a strong password" required />
            <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat your password" required />

            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="sr-only" />
                <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                  style={{ backgroundColor: agreed ? 'var(--color-purple)' : 'transparent', borderColor: agreed ? 'var(--color-purple)' : 'var(--color-border)' }}>
                  {agreed && <CheckCircle size={10} color="#fff" />}
                </div>
              </div>
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                I agree to the{' '}
                <Link href="/terms/affiliates" style={{ color: 'var(--color-purple-light)' }} className="hover:underline">Affiliate Programme Policy</Link>
                {' and '}
                <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }} className="hover:underline">Privacy Policy</Link>
              </span>
            </label>

            <Button type="submit" size="lg" fullWidth disabled={!agreed || loading}>
              {loading ? 'Creating account…' : 'Create Affiliate Account'}
            </Button>
          </form>

          <p className="text-sm text-center mt-5 pt-5 border-t" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            Already have an account?{' '}
            <Link href="/affiliate/login" className="font-medium hover:underline" style={{ color: 'var(--color-purple-light)' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
