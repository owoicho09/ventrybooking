/**
 * Normalizes organiser input for restricted-audience events: strips a
 * leading "@", lowercases, trims, drops empties/duplicates. Stored form is
 * always bare domains (e.g. "nileuniversity.edu.ng"), never "@domain".
 */
export function normalizeEmailDomains(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw
    .map(d => String(d ?? '').trim().toLowerCase().replace(/^@/, ''))
    .filter(d => d.length > 0 && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
  return Array.from(new Set(cleaned));
}

export function isEmailDomainAllowed(email: string, allowedDomains: string[] | null | undefined): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return allowedDomains.includes(domain);
}
