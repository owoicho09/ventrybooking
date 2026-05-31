export const NIGERIAN_BANKS = [
  { name: 'Access Bank',       code: '044' },
  { name: 'Fidelity Bank',     code: '070' },
  { name: 'First Bank',        code: '011' },
  { name: 'FCMB',              code: '214' },
  { name: 'GTBank',            code: '058' },
  { name: 'Heritage Bank',     code: '030' },
  { name: 'Keystone Bank',     code: '082' },
  { name: 'Kuda Bank',         code: '090267' },
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

export function getBankCode(bankName: string): string | undefined {
  return NIGERIAN_BANKS.find(b => b.name === bankName)?.code;
}
