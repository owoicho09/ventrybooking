export const NIGERIAN_BANKS = [
  { name: 'Access Bank',       code: '044' },
  { name: 'Fidelity Bank',     code: '070' },
  { name: 'First Bank',        code: '011' },
  { name: 'FCMB',              code: '214' },
  { name: 'GTBank',            code: '058' },
  { name: 'Heritage Bank',     code: '030' },
  { name: 'Keystone Bank',     code: '082' },
  { name: 'Kuda Bank',         code: '090267' },
  { name: 'Moniepoint',        code: '50515' },
  { name: 'Opay',              code: '100004' },
  { name: 'Palmpay',           code: '100033' },
  { name: 'Polaris Bank',      code: '076' },
  { name: 'Providus Bank',     code: '101' },
  { name: 'Stanbic IBTC',      code: '221' },
  { name: 'Standard Chartered',code: '068' },
  { name: 'Sterling Bank',     code: '232' },
  { name: 'UBA',               code: '033' },
  { name: 'Union Bank',        code: '032' },
  { name: 'Unity Bank',        code: '215' },
  { name: 'Wema Bank',         code: '035' },
  { name: 'Zenith Bank',       code: '057' },
] as const;

export type BankName = typeof NIGERIAN_BANKS[number]['name'];

// Common aliases and alternate spellings organizers might enter
const ALIASES: Record<string, string> = {
  'access':                     'Access Bank',
  'gtb':                        'GTBank',
  'guaranty trust':             'GTBank',
  'guaranty trust bank':        'GTBank',
  'gt bank':                    'GTBank',
  'zenith':                     'Zenith Bank',
  'first bank of nigeria':      'First Bank',
  'fbn':                        'First Bank',
  'firstbank':                  'First Bank',
  'united bank for africa':     'UBA',
  'first city monument bank':   'FCMB',
  'stanbic':                    'Stanbic IBTC',
  'stanbic ibtc bank':          'Stanbic IBTC',
  'standard chartered bank':    'Standard Chartered',
  'sterling':                   'Sterling Bank',
  'heritage':                   'Heritage Bank',
  'keystone':                   'Keystone Bank',
  'polaris':                    'Polaris Bank',
  'providus':                   'Providus Bank',
  'unity':                      'Unity Bank',
  'union':                      'Union Bank',
  'wema':                       'Wema Bank',
  'alat':                       'Wema Bank',
  'alat by wema':               'Wema Bank',
  'kuda':                       'Kuda Bank',
  'fidelity':                   'Fidelity Bank',
  'moniepoint mfb':             'Moniepoint',
  'moniepoint microfinance bank': 'Moniepoint',
};

/**
 * Loose match between a registered name and a bank-resolved account name —
 * true if every word of the shorter name appears in the longer one. Not
 * exact-string equality: Paystack often resolves to a fuller legal name
 * (e.g. "JOHN ADEYEMI DOE") than what someone typed at signup ("John Doe"),
 * and that's still a real match, not a mismatch to reject.
 */
export function namesLikelyMatch(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const wa = words(a);
  const wb = words(b);
  if (wa.length === 0 || wb.length === 0) return false;
  const [shorter, longer] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  const longerSet = new Set(longer);
  return shorter.every(w => longerSet.has(w));
}

export function getBankCode(bankName: string): string | undefined {
  const normalized = bankName.trim().toLowerCase();
  // Exact case-insensitive match first
  const exact = NIGERIAN_BANKS.find(b => b.name.toLowerCase() === normalized);
  if (exact) return exact.code;
  // Alias lookup
  const canonical = ALIASES[normalized];
  if (canonical) return NIGERIAN_BANKS.find(b => b.name === canonical)?.code;
  return undefined;
}
