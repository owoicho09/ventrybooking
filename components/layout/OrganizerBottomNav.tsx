'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  ScanLine,
  KeyRound,
  Settings,
} from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';

const navItems = [
  { href: '/organizer/dashboard',     label: 'Overview',  icon: LayoutDashboard },
  { href: '/organizer/events',        label: 'My Events', icon: CalendarDays },
  { href: '/organizer/events/create', label: 'Create',    icon: PlusCircle },
  { href: '/organizer/scan',          label: 'Scanner',   icon: ScanLine },
  { href: '/organizer/staff',         label: 'Staff IDs', icon: KeyRound },
  { href: '/organizer/settings',      label: 'Settings',  icon: Settings },
];

export function OrganizerBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        height: '4rem',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          (href !== '/organizer/dashboard' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{ color: active ? 'var(--color-purple-light)' : 'var(--color-text-muted)' }}
          >
            <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[9px] font-medium leading-none">{label}</span>
          </Link>
        );
      })}
      <div className="flex-1 flex flex-col items-center justify-center">
        <NotificationBell openUp />
        <span className="text-[9px] font-medium leading-none mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Alerts</span>
      </div>
    </nav>
  );
}
