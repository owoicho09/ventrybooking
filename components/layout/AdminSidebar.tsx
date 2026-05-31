'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UserCheck,
  CalendarCheck,
  MessageSquareWarning,
  Wallet,
  ShieldAlert,
  Settings,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/organizers', label: 'KYC Review', icon: UserCheck },
  { href: '/admin/events', label: 'Events Queue', icon: CalendarCheck },
  { href: '/admin/complaints', label: 'Complaints', icon: MessageSquareWarning },
  { href: '/admin/payouts', label: 'Payouts', icon: Wallet },
  { href: '/admin/fraud', label: 'Fraud Monitor', icon: ShieldAlert },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 h-full w-60 flex flex-col border-r z-40"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Logo */}
      <div
        className="h-16 flex items-center px-5 border-b gap-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <Link
          href="/admin"
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-syne), sans-serif' }}
        >
          <span style={{ color: 'var(--color-purple)' }}>V</span>
          <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
        </Link>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--color-purple-dim)',
            color: 'var(--color-purple-light)',
          }}
        >
          ADMIN
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: active ? 'var(--color-purple-dim)' : 'transparent',
                color: active ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
              }}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div
        className="p-3 border-t flex items-center justify-end"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <ThemeToggle />
      </div>
    </aside>
  );
}
