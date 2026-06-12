'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Shield, Zap, Users } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const benefits = [
  { icon: Zap, text: 'Instant access after email verification — no waiting' },
  { icon: Shield, text: 'Escrow protects your reputation — buyers trust you' },
  { icon: Users, text: 'Full dashboard: sales, scans, payouts' },
];

export default function OrganizerRegisterPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/organizer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      router.push('/organizer/verify');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col justify-center px-12 py-16 w-[420px] flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #1a0a3d 0%, #0f0a2d 100%)', borderRight: '1px solid #7c3aed30' }}>
        <Link href="/" className="text-2xl font-bold tracking-tight mb-12" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
          <span style={{ color: 'var(--color-purple-light)' }}>V</span>
          <span style={{ color: '#fff' }}>ENTRY</span>
        </Link>
        <h2 className="text-3xl font-bold text-white mb-3 leading-tight" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
          Start selling tickets. Keep your reputation.
        </h2>
        <p className="text-sm mb-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Join 500+ organizers who trust Ventry to sell tickets with zero risk.
        </p>
        <div className="flex flex-col gap-5">
          {benefits.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: 'rgba(124,58,237,0.3)', color: 'var(--color-purple-light)' }}>
                <Icon size={15} />
              </div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden text-xl font-bold tracking-tight mb-8 inline-block" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
            <span style={{ color: 'var(--color-purple)' }}>V</span>
            <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
          </Link>

          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            Create your organizer account
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
            Already have an account?{' '}
            <Link href="/organizer/login" className="hover:underline" style={{ color: 'var(--color-purple-light)' }}>Sign In</Link>
          </p>

          {error && (
            <div className="mb-4 rounded-lg px-4 py-3 text-sm border" style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full Name" value={form.name} onChange={set('name')} placeholder="Chukwuemeka Obi" required />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
            <Input label="Phone Number" type="tel" value={form.phone} onChange={set('phone')} placeholder="+234 801 234 5678" required />
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
                <Link href="/terms" style={{ color: 'var(--color-purple-light)' }} className="hover:underline">Organizer Terms</Link>
              </span>
            </label>

            <Button type="submit" size="lg" fullWidth disabled={!agreed || loading} className="mt-2">
              {loading ? 'Creating account...' : 'Create Organizer Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
