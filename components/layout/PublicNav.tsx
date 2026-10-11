'use client';

import '@/app/v2.css';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useBuyerAuth } from '@/lib/hooks/useBuyerAuth';

const NAV_LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#for-organisers', label: 'For organisers' },
  { href: '/blog', label: 'Blog' },
];

export function PublicNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { loggedIn: buyerLoggedIn, loading: buyerLoading, firstName } = useBuyerAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await fetch('/api/buyer/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  const isActive = (href: string) => href === pathname || (href !== '/' && !href.includes('#') && pathname.startsWith(href));

  return (
    <nav className="v2 v-nav" aria-label="Main">
      <div className="v-nav-in">
        <Link href="/" className="v-logo" aria-label="Ventry home"><span>V</span>ENTRY</Link>

        <div className="v-nav-links">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className={isActive(l.href) ? 'on' : undefined}>{l.label}</Link>
          ))}
        </div>

        <div className="v-nav-cta">
          <button type="button" className="v-icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* The single public-header auth entry: buyer sign-in, or a small
              menu once signed in. Organiser/affiliate doors live at /signin. */}
          {!buyerLoading && (buyerLoggedIn ? (
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button type="button" className="v-btn v-btn-ghost" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-haspopup="menu">
                {firstName ? `Hi, ${firstName}` : 'My tickets'}
                <ChevronDown size={14} style={{ transform: menuOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
              </button>
              {menuOpen && (
                <div className="v-menu" role="menu">
                  <Link href="/account" role="menuitem" onClick={() => setMenuOpen(false)}>My tickets</Link>
                  <Link href="/account/following" role="menuitem" onClick={() => setMenuOpen(false)}>Following</Link>
                  <hr />
                  <button type="button" role="menuitem" onClick={handleSignOut} style={{ color: 'var(--muted)' }}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/signin" className="v-btn v-btn-ghost">Sign in</Link>
          ))}

          <Link href="/organizer/register" className="v-btn v-btn-solid hide-xs">List your event</Link>

          <button
            type="button"
            className="v-icon-btn v-nav-burger"
            onClick={() => setMobileOpen(o => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="v-mobile-panel">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}>{l.label}</Link>
          ))}
          <Link href="/organizer/register" onClick={() => setMobileOpen(false)} style={{ color: 'var(--purple-lt)' }}>List your event</Link>
        </div>
      )}
    </nav>
  );
}
