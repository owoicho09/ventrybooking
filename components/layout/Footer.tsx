import Link from 'next/link';

export function Footer() {
  const links = [
    { href: '/events', label: 'Events' },
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#for-organizers', label: 'For Organizers' },
    { href: '/help', label: 'Help & Refunds' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms' },
  ];

  return (
    <footer
      className="border-t mt-20"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div
              className="text-xl font-bold tracking-tight mb-2"
              style={{ fontFamily: 'var(--font-syne), sans-serif' }}
            >
              <span style={{ color: 'var(--color-purple)' }}>V</span>
              <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Secure event ticketing for Nigeria.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm transition-colors hover:text-[var(--color-text)]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div
          className="mt-8 pt-8 border-t text-sm"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-dim)',
          }}
        >
          &copy; 2026 Ventry. All rights reserved. ventrybooking.com
        </div>
      </div>
    </footer>
  );
}
