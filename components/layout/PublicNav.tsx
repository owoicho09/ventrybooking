'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

export function PublicNav() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/events', label: 'Events' },
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#for-organizers', label: 'For Organizers' },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-border)]"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1 shrink-0">
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-syne), sans-serif' }}
          >
            <span style={{ color: 'var(--color-purple)' }}>V</span>
            <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
          </span>
        </Link>

        {/* Center Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 text-sm rounded-lg transition-colors"
              style={{
                color: pathname === link.href ? 'var(--color-text)' : 'var(--color-text-muted)',
                backgroundColor: pathname === link.href ? 'var(--color-surface-2)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (pathname !== link.href) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-text)';
                }
              }}
              onMouseLeave={(e) => {
                if (pathname !== link.href) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
                }
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <Link
            href="/organizer/register"
            className="hidden sm:flex items-center px-4 py-2 text-sm rounded-lg border transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-purple)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-purple)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text)';
            }}
          >
            Post an Event
          </Link>
          <Link
            href="/organizer/login"
            className="flex items-center px-4 py-2 text-sm rounded-lg font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--color-purple)',
              color: '#fff',
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  );
}
