'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  ScanLine,
  KeyRound,
  Settings,
  Wallet,
  Share2,
  MoreHorizontal,
} from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { Drawer } from '@/components/ui/Drawer';

const navItems = [
  { href: '/organizer/dashboard',     label: 'Overview',   icon: LayoutDashboard },
  { href: '/organizer/events',        label: 'My Events',  icon: CalendarDays },
  { href: '/organizer/events/create', label: 'Create',     icon: PlusCircle },
  { href: '/organizer/affiliates',    label: 'Affiliates', icon: Share2 },
];

// Secondary items that don't fit directly on the bar — reachable via "More".
const moreItems = [
  { href: '/organizer/staff',    label: 'Staff IDs', icon: KeyRound },
  { href: '/organizer/payouts',  label: 'Payouts',   icon: Wallet },
  { href: '/organizer/scan',     label: 'Scanner',   icon: ScanLine },
  { href: '/organizer/settings', label: 'Settings',  icon: Settings },
];

export function OrganizerBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Auto-close the sheet after navigating to one of its own links.
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const moreActive = moreItems.some(({ href }) => pathname.startsWith(href));

  return (
    <>
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
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
          style={{ color: moreActive ? 'var(--color-purple-light)' : 'var(--color-text-muted)' }}
        >
          <MoreHorizontal size={19} strokeWidth={moreActive ? 2.5 : 1.8} />
          <span className="text-[9px] font-medium leading-none">More</span>
        </button>
        <div className="flex-1 flex flex-col items-center justify-center">
          <NotificationBell openUp />
          <span className="text-[9px] font-medium leading-none mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Alerts</span>
        </div>
      </nav>

      <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} title="More" placement="bottom">
        <div className="flex flex-col gap-1">
          {moreItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: active ? 'var(--color-purple-dim)' : 'transparent', color: active ? 'var(--color-purple-light)' : 'var(--color-text)' }}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </div>
      </Drawer>
    </>
  );
}
