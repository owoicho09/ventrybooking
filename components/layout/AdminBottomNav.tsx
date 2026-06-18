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
} from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';

const navItems = [
  { href: '/admin',            label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/organizers', label: 'KYC',        icon: UserCheck },
  { href: '/admin/events',     label: 'Events',     icon: CalendarCheck },
  { href: '/admin/complaints', label: 'Complaints', icon: MessageSquareWarning },
  { href: '/admin/payouts',    label: 'Payouts',    icon: Wallet },
  { href: '/admin/fraud',      label: 'Fraud',      icon: ShieldAlert },
];

export function AdminBottomNav() {
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
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
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
