import type { SupabaseClient } from '@supabase/supabase-js';
import { isEmailDomainAllowed, normalizeEmailDomains } from '@/lib/server/domainRestriction';

/**
 * Gated ticket tiers (migration 054): the one place that decides whether a
 * buyer may buy a tier. Paid checkout, free checkout and the unlock endpoint
 * all go through here, so the rule can't drift between them.
 *
 * Two gates per tier, independent and combinable:
 *   - requires_code: an active promo code for this tier must be supplied.
 *   - allowed_email_domains: the ticket holder's email (already verified by
 *     the checkout email code) must be at one of these domains.
 * The event-wide domain gate (events.allowed_email_domains) is checked by the
 * checkout routes separately, as before, and applies on top.
 */

export const ACCESS_CODE_MIN = 4;
export const ACCESS_CODE_MAX = 8;
const ACCESS_CODE_RE = /^[A-Z0-9]{4,8}$/;

/** Case-insensitive: "vip 2026" and "VIP2026" are the same code. */
export function normalizeAccessCode(raw: unknown): string {
  return String(raw ?? '').replace(/\s+/g, '').toUpperCase();
}

export function accessCodeProblem(code: string): string | null {
  if (!ACCESS_CODE_RE.test(code)) return `Codes are ${ACCESS_CODE_MIN}–${ACCESS_CODE_MAX} letters or numbers, no spaces or symbols`;
  return null;
}

export { normalizeEmailDomains as normalizeTierDomains };

export interface GatedTier {
  id: string;
  name: string;
  requires_code?: boolean | null;
  allowed_email_domains?: string[] | null;
}

export function domainLabel(domains: string[]): string {
  return domains.map(d => `@${d}`).join(' or ');
}

// ── Brute-force limiting ────────────────────────────────────────────────
// A 4-character code is guessable by a script, and the in-memory limiter
// only sees one server instance, so failed entries are counted in the DB:
//   per connection (IP) + event: 10 wrong codes / 15 min.
// Deliberately NO tier-wide limit shared by everyone: that would let a few
// connections spamming wrong codes lock real buyers out of the tier (even at
// checkout, after they'd already unlocked it). One connection's mistakes
// only ever block that connection.
const IP_LIMIT = 10, IP_WINDOW_MIN = 15;

const attemptKey = (ip: string, eventId: string) => `ip:${ip}:event:${eventId}`;

export async function codeAttemptsBlocked(db: SupabaseClient, ip: string, eventId: string): Promise<boolean> {
  const { count } = await db
    .from('tier_code_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('key', attemptKey(ip, eventId))
    .gte('created_at', new Date(Date.now() - IP_WINDOW_MIN * 60_000).toISOString());
  return (count ?? 0) >= IP_LIMIT;
}

async function recordFailedAttempt(db: SupabaseClient, ip: string, eventId: string) {
  const { error } = await db.from('tier_code_attempts').insert({ key: attemptKey(ip, eventId) });
  if (error) console.error('tierAccess: failed to record attempt', error.message);
}

export const TOO_MANY_ATTEMPTS_MSG = 'Too many wrong codes. Wait 15 minutes and try again.';

// ── Code check ──────────────────────────────────────────────────────────

export type CodeCheck =
  | { ok: true; codeId: string }
  | { ok: false; status: number; error: string; code: 'ACCESS_CODE_REQUIRED' | 'ACCESS_CODE_INVALID' | 'TOO_MANY_ATTEMPTS' };

/**
 * Checks a buyer-supplied code against a tier's active codes. Failed entries
 * count towards the brute-force limit; the caller never learns *why* a code
 * failed (wrong vs. switched off), so codes can't be probed.
 */
export async function checkTierCode(
  db: SupabaseClient,
  args: { eventId: string; tier: GatedTier; rawCode: unknown; ip: string },
): Promise<CodeCheck> {
  const code = normalizeAccessCode(args.rawCode);
  if (!code) {
    return { ok: false, status: 403, code: 'ACCESS_CODE_REQUIRED', error: `"${args.tier.name}" needs a promo code. Enter it on the event page to unlock this ticket.` };
  }
  if (await codeAttemptsBlocked(db, args.ip, args.eventId)) {
    return { ok: false, status: 429, code: 'TOO_MANY_ATTEMPTS', error: TOO_MANY_ATTEMPTS_MSG };
  }
  const { data } = ACCESS_CODE_RE.test(code)
    ? await db
        .from('tier_access_codes')
        .select('id')
        .eq('event_id', args.eventId)
        .eq('tier_id', args.tier.id)
        .eq('code', code)
        .eq('active', true)
        .maybeSingle()
    : { data: null };
  if (!data) {
    await recordFailedAttempt(db, args.ip, args.eventId);
    return { ok: false, status: 403, code: 'ACCESS_CODE_INVALID', error: `That code doesn’t work for "${args.tier.name}". Check it with whoever gave it to you.` };
  }
  return { ok: true, codeId: data.id };
}

// ── Whole-cart check (checkout) ─────────────────────────────────────────

export interface AccessCartItem { tierId: string; quantity: number; accessCode?: unknown }

export type CartAccess =
  | { ok: true; codeIdByTier: Map<string, string> }
  | { ok: false; status: number; error: string; code: string };

/**
 * Runs both tier gates for every line in a cart. `email` is the ticket
 * holder's address (the one the checkout email code verified). Domain gates
 * run first: they cost nothing and must not burn code attempts.
 */
export async function checkCartAccess(
  db: SupabaseClient,
  args: { eventId: string; email: string; ip: string; items: AccessCartItem[]; tierById: Map<string, GatedTier> },
): Promise<CartAccess> {
  for (const item of args.items) {
    const tier = args.tierById.get(item.tierId);
    if (!tier) continue;
    const domains = tier.allowed_email_domains ?? [];
    if (domains.length > 0 && !isEmailDomainAllowed(args.email, domains)) {
      return {
        ok: false, status: 403, code: 'TIER_DOMAIN_RESTRICTED',
        error: `"${tier.name}" is only for ${domainLabel(domains)} email addresses.`,
      };
    }
  }

  const codeIdByTier = new Map<string, string>();
  for (const item of args.items) {
    const tier = args.tierById.get(item.tierId);
    if (!tier?.requires_code) continue;
    const res = await checkTierCode(db, { eventId: args.eventId, tier, rawCode: item.accessCode, ip: args.ip });
    if (!res.ok) return res;
    codeIdByTier.set(tier.id, res.codeId);
  }
  return { ok: true, codeIdByTier };
}

/** Public-safe view of a tier's gates (never includes codes). */
export function publicTierGates(t: { requires_code?: boolean | null; allowed_email_domains?: string[] | null }) {
  return {
    requiresCode: t.requires_code === true,
    allowedEmailDomains: t.allowed_email_domains && t.allowed_email_domains.length > 0 ? t.allowed_email_domains : null,
  };
}
