// In-memory rate limiter. Works within a single server process/warm instance.
// For multi-instance or serverless deployments at scale, swap the store for
// Redis (e.g. Upstash). For a single event with ~200 attendees this is fine.

interface Entry { count: number; resetAt: number }
const store = new Map<string, Entry>();

// Evict expired entries every 5 minutes to prevent unbounded growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) if (now > v.resetAt) store.delete(k);
  }, 5 * 60 * 1000);
}

/**
 * Returns true if the request should proceed, false if it is rate-limited.
 * @param key         Unique key, typically an IP address
 * @param limit       Max allowed requests per window
 * @param windowSecs  Rolling window length in seconds
 */
export function checkRateLimit(key: string, limit: number, windowSecs: number): boolean {
  const now = Date.now();
  const windowMs = windowSecs * 1000;
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/** Extract the best available IP address from a Next.js request. */
export function getIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}
