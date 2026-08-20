// Every top-level static route segment in the app — a slug/handle can never
// equal one of these, so a future real route added at that name can never
// silently shadow an already-issued vanity URL.
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'blog', 'checkout', 'events', 'help', 'organizer',
  'payment', 'privacy', 'refund-policy', 'retrieve', 'scan', 'staff-scan',
  'studio', 'terms', 'ticket', 'tickets', 'sitemap.xml', 'robots.txt',
  'favicon.ico', 'icon', 'opengraph-image',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(value: string): boolean {
  return UUID_RE.test(value);
}

/** Kebab-case a title into a slug base. Matches the SQL backfill in migrations.sql. */
export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'event';
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
