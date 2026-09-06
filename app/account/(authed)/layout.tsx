'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';

const TABS = [
  { href: '/account', label: 'My Tickets' },
  { href: '/account/following', label: 'Following' },
  { href: '/account/reviews', label: 'Reviews' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/buyer/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-16 max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            My Account
          </h1>
          <button
            onClick={handleLogout}
            className="text-sm transition-colors hover:underline"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Sign out
          </button>
        </div>

        <div className="flex gap-1 mb-8 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {TABS.map(tab => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
                style={{
                  borderColor: active ? 'var(--color-purple)' : 'transparent',
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
      <Footer />
    </div>
  );
}
