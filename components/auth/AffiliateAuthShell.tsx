import Link from 'next/link';

/** Page frame for the affiliate auth screens, matching the affiliate sign-in page. */
export function AffiliateAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl font-bold tracking-tight inline-block" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
            <span style={{ color: 'var(--color-purple)' }}>V</span>
            <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
