import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeEmailDomains } from '@/lib/server/domainRestriction';
import { accessCodeProblem, normalizeAccessCode } from '@/lib/server/tierAccess';

export interface ParsedTierGates {
  requiresCode: boolean;
  codes: string[];
  allowedEmailDomains: string[];
}

export const MAX_CODES_PER_TIER = 50;

/**
 * Reads an organiser's tier-gate input (create form / add-tier form):
 *   { requiresCode?: boolean, codes?: string[], allowedEmailDomains?: string[] }
 * A promo tier must start with at least one valid code, otherwise nobody
 * could ever buy it.
 */
export function parseTierGates(raw: unknown, tierName: string): { ok: true; value: ParsedTierGates } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const requiresCode = r.requiresCode === true;

  const codes: string[] = [];
  if (requiresCode) {
    const list = Array.isArray(r.codes) ? r.codes : [];
    for (const c of list) {
      const code = normalizeAccessCode(c);
      if (!code) continue;
      const problem = accessCodeProblem(code);
      if (problem) return { ok: false, error: `${tierName}: "${String(c)}" isn't a valid code. ${problem}.` };
      if (!codes.includes(code)) codes.push(code);
    }
    if (codes.length === 0) return { ok: false, error: `${tierName} is a promo code ticket. Add at least one code.` };
    if (codes.length > MAX_CODES_PER_TIER) return { ok: false, error: `${tierName}: up to ${MAX_CODES_PER_TIER} codes per tier.` };
  }

  const rawDomains = Array.isArray(r.allowedEmailDomains) ? r.allowedEmailDomains : [];
  const allowedEmailDomains = normalizeEmailDomains(rawDomains);
  if (rawDomains.some(d => String(d ?? '').trim()) && allowedEmailDomains.length === 0) {
    return { ok: false, error: `${tierName}: enter email domains like company.com or unilag.edu.ng.` };
  }

  return { ok: true, value: { requiresCode, codes, allowedEmailDomains } };
}

/** The tier, if it belongs to an event this organiser owns. */
export async function ownedTier(db: SupabaseClient, organizerId: string, eventId: string, tierId: string) {
  const { data } = await db
    .from('ticket_tiers')
    .select('id, event:events!inner(id, organizer_id)')
    .eq('id', tierId)
    .eq('event_id', eventId)
    .maybeSingle();
  const ev = data && (Array.isArray(data.event) ? data.event[0] : data.event) as { id: string; organizer_id: string } | null;
  return data && ev?.organizer_id === organizerId ? data : null;
}
