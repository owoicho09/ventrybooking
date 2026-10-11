// Dojah (licensed identity provider) — NIN and CAC lookups for organiser
// verification (Organiser Terms 3.4, 3.5).
//
// Env:
//   DOJAH_APP_ID      — App ID from the Dojah dashboard
//   DOJAH_SECRET_KEY  — the app's secret key (sent as-is, not "Bearer …")
//   DOJAH_BASE_URL    — optional; https://sandbox.dojah.io for testing
//                       (sandbox NIN 70123456789, RC 1261103). Defaults to live.
// Docs: docs.dojah.io/api-reference — /api/v1/kyc/nin, /api/v1/kyc/cac/basic

export type CacCompanyType =
  | 'BUSINESS_NAME' | 'COMPANY' | 'INCORPORATED_TRUSTEES' | 'LIMITED_PARTNERSHIP' | 'LIMITED_LIABILITY_PARTNERSHIP';

export const CAC_COMPANY_TYPES: { value: CacCompanyType; label: string }[] = [
  { value: 'BUSINESS_NAME', label: 'Business name (BN)' },
  { value: 'COMPANY', label: 'Company (RC / Ltd)' },
  { value: 'INCORPORATED_TRUSTEES', label: 'Incorporated trustees (IT)' },
  { value: 'LIMITED_PARTNERSHIP', label: 'Limited partnership' },
  { value: 'LIMITED_LIABILITY_PARTNERSHIP', label: 'Limited liability partnership' },
];

export interface NinRecord {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string | null; // YYYY-MM-DD as returned
}

export interface CacRecord {
  companyName: string;
  status: string | null;
  rcNumber: string;
  type: string | null;
}

export type LookupResult<T> =
  | { ok: true; record: T }
  | { ok: false; kind: 'not_found' | 'invalid' | 'unavailable' | 'config'; message: string };

function config() {
  const appId = process.env.DOJAH_APP_ID;
  const secret = process.env.DOJAH_SECRET_KEY;
  const base = (process.env.DOJAH_BASE_URL || 'https://api.dojah.io').replace(/\/+$/, '');
  return appId && secret ? { appId, secret, base } : null;
}

export function dojahConfigured(): boolean {
  return config() !== null;
}

async function get(path: string, query: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const c = config();
  if (!c) throw new Error('Dojah is not configured');
  const url = `${c.base}${path}?${new URLSearchParams(query)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { AppId: c.appId, Authorization: c.secret, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function failure(status: number, body: unknown): { ok: false; kind: 'not_found' | 'invalid' | 'unavailable' | 'config'; message: string } {
  const msg = (body as { error?: string; message?: string } | null);
  const detail = msg?.error || msg?.message || '';
  if (status === 404) return { ok: false, kind: 'not_found', message: 'No record was found for that number.' };
  if (status === 400) return { ok: false, kind: 'invalid', message: detail || 'That number doesn’t look right. Check it and try again.' };
  if (status === 401 || status === 402) {
    // Our side: bad keys or an empty Dojah wallet. Never blame the organiser.
    console.error('dojah: account problem', status, detail);
    return { ok: false, kind: 'config', message: 'Verification is temporarily unavailable. Please try again later.' };
  }
  console.error('dojah: upstream error', status, detail);
  return { ok: false, kind: 'unavailable', message: 'The verification service didn’t respond. Please try again in a few minutes.' };
}

export async function lookupNin(nin: string): Promise<LookupResult<NinRecord>> {
  if (!/^\d{11}$/.test(nin)) return { ok: false, kind: 'invalid', message: 'A NIN is 11 digits.' };
  if (!config()) return { ok: false, kind: 'config', message: 'Verification is temporarily unavailable. Please try again later.' };
  try {
    const { status, body } = await get('/api/v1/kyc/nin', { nin });
    const e = (body as { entity?: Record<string, unknown> } | null)?.entity;
    if (status !== 200 || !e) return failure(status === 200 ? 404 : status, body);
    return {
      ok: true,
      record: {
        firstName: String(e.first_name ?? '').trim(),
        middleName: String(e.middle_name ?? '').trim(),
        lastName: String(e.last_name ?? '').trim(),
        dateOfBirth: e.date_of_birth ? String(e.date_of_birth).slice(0, 10) : null,
      },
    };
  } catch (err) {
    console.error('dojah: nin lookup failed', err);
    return { ok: false, kind: 'unavailable', message: 'The verification service didn’t respond. Please try again in a few minutes.' };
  }
}

export async function lookupCac(rcNumber: string, companyType: CacCompanyType): Promise<LookupResult<CacRecord>> {
  const rc = rcNumber.trim().toUpperCase().replace(/^(RC|BN|IT)[\s-]*/, '');
  if (!/^\d{3,10}$/.test(rc)) return { ok: false, kind: 'invalid', message: 'Enter the registration number digits, e.g. 1261103.' };
  if (!CAC_COMPANY_TYPES.some(t => t.value === companyType)) return { ok: false, kind: 'invalid', message: 'Choose the type of registration.' };
  if (!config()) return { ok: false, kind: 'config', message: 'Verification is temporarily unavailable. Please try again later.' };
  try {
    const { status, body } = await get('/api/v1/kyc/cac/basic', { rc_number: rc, company_type: companyType });
    const e = (body as { entity?: Record<string, unknown> } | null)?.entity;
    if (status !== 200 || !e || !e.company_name) return failure(status === 200 ? 404 : status, body);
    return {
      ok: true,
      record: {
        companyName: String(e.company_name).trim(),
        status: e.status ? String(e.status) : null,
        rcNumber: String(e.rc_number ?? rc),
        type: e.type_of_company ? String(e.type_of_company) : null,
      },
    };
  } catch (err) {
    console.error('dojah: cac lookup failed', err);
    return { ok: false, kind: 'unavailable', message: 'The verification service didn’t respond. Please try again in a few minutes.' };
  }
}
