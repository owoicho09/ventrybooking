'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  ScanLine,
  Wallet,
  Settings,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const navItems = [
  { href: '/organizer/dashboard',      label: 'Overview',    icon: LayoutDashboard },
  { href: '/organizer/events',         label: 'My Events',   icon: CalendarDays },
  { href: '/organizer/events/create',  label: 'Create Event',icon: PlusCircle },
  { href: '/organizer/scan',           label: 'Scanner',     icon: ScanLine },
  { href: '/organizer/staff',          label: 'Staff IDs',   icon: KeyRound },
  { href: '/organizer/payouts',        label: 'Payouts',     icon: Wallet },
  { href: '/organizer/settings',       label: 'Settings',    icon: Settings },
];

export function OrganizerSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/organizer/login');
    router.refresh();
  };

  return (
    <aside
      className="hidden lg:flex lg:flex-col fixed top-0 left-0 h-full w-60 border-r z-40"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <Link href="/organizer/dashboard" className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
          <span style={{ color: 'var(--color-purple)' }}>V</span>
          <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/organizer/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: active ? 'var(--color-purple-dim)' : 'transparent', color: active ? 'var(--color-purple-light)' : 'var(--color-text-muted)' }}>
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:text-red-400"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut size={16} />
          Logout
        </button>
        <ThemeToggle />
      </div>
    </aside>
  );
}
