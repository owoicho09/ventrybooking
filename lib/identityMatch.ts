// Name matching for identity and bank-account checks. Names on Nigerian
// records vary in order, case, punctuation and middle names, so we compare
// sets of name tokens rather than whole strings.

const STOP = new Set(['mr', 'mrs', 'miss', 'ms', 'dr', 'chief', 'alhaji', 'alhaja', 'engr', 'prof', 'pastor', 'rev']);
const COMPANY_NOISE = new Set(['ltd', 'limited', 'plc', 'nig', 'nigeria', 'enterprise', 'enterprises', 'ventures', 'venture', 'global', 'services', 'company', 'co', 'the', 'and', 'of', 'int', 'intl', 'international', 'concept', 'concepts']);

export function nameTokens(name: string, opts: { company?: boolean } = {}): string[] {
  return name
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t) && !(opts.company && COMPANY_NOISE.has(t)));
}

/**
 * A person's name matches when the record's first AND last names both appear
 * in the other name (any order). Middle names are optional either side.
 */
export function personNameMatches(record: { firstName: string; lastName: string }, other: string): boolean {
  const have = new Set(nameTokens(other));
  const first = nameTokens(record.firstName);
  const last = nameTokens(record.lastName);
  if (first.length === 0 || last.length === 0) return false;
  return first.every(t => have.has(t)) && last.every(t => have.has(t));
}

/**
 * Loose match between two full names (e.g. a bank account name against the
 * verified name): every token of the shorter name must appear in the longer,
 * and at least two tokens must be shared (unless both names are one word).
 */
export function fullNamesMatch(a: string, b: string, opts: { company?: boolean } = {}): boolean {
  const ta = nameTokens(a, opts);
  const tb = nameTokens(b, opts);
  if (ta.length === 0 || tb.length === 0) return false;
  const [short, long] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  const shared = short.filter(t => long.has(t)).length;
  // Two shared names unless both sides genuinely are a single word, so a
  // surname alone (a relative's account) never counts as a match.
  return shared === short.length && shared >= Math.min(2, Math.max(ta.length, tb.length));
}

export function fullName(r: { firstName: string; middleName?: string; lastName: string }): string {
  return [r.firstName, r.middleName, r.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
