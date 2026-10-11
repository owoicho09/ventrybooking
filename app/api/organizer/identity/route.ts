import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { lookupNin, lookupCac, dojahConfigured, CAC_COMPANY_TYPES, type CacCompanyType } from '@/lib/server/dojah';
import { personNameMatches, fullNamesMatch, fullName } from '@/lib/identityMatch';
import { loadSettledTotals, UNVERIFIED_SETTLEMENT_CAP } from '@/lib/server/settlements';
import { notify } from '@/lib/server/notify';

// Identity verification (Organiser Terms 3.3–3.11) through Dojah:
//   individuals: NIN + date of birth, matched against their legal name;
//   businesses:  CAC registration, matched against the registered name.
// We keep only what's needed to show the result: the name on record, the
// type, and the last 4 digits / RC number. Never the full NIN, the photo or
// the date of birth.

const MAX_ATTEMPTS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

type UserRow = {
  id: string; name: string; legal_name: string | null; verified: boolean;
  identity_status: string; identity_type: string | null; identity_name: string | null; identity_ref: string | null;
  identity_verified_at: string | null; identity_attempts: number; identity_last_attempt_at: string | null; identity_last_error: string | null;
  account_name: string | null; account_number: string | null; bank_name: string | null; bank_name_matched: boolean | null;
};

const COLS = 'id, name, legal_name, verified, identity_status, identity_type, identity_name, identity_ref, identity_verified_at, identity_attempts, identity_last_attempt_at, identity_last_error, account_name, account_number, bank_name, bank_name_matched';

function attemptsUsed(u: UserRow): number {
  if (!u.identity_last_attempt_at) return 0;
  return Date.now() - new Date(u.identity_last_attempt_at).getTime() > DAY_MS ? 0 : u.identity_attempts;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getServerSupabase();
  const { data } = await db.from('users').select(COLS).eq('id', user.sub).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const u = data as UserRow;
  const settled = (await loadSettledTotals(db, [u.id])).get(u.id) ?? 0;
  return NextResponse.json({
    success: true,
    data: {
      status: u.identity_status,
      type: u.identity_type,
      name: u.identity_name,
      ref: u.identity_ref,
      verifiedAt: u.identity_verified_at,
      legalName: u.legal_name,
      lastError: u.identity_last_error,
      attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_DAY - attemptsUsed(u)),
      available: dojahConfigured(),
      bank: { accountName: u.account_name, hasAccount: !!u.account_number, matched: u.bank_name_matched },
      settledTotal: settled,
      cap: UNVERIFIED_SETTLEMENT_CAP,
      companyTypes: CAC_COMPANY_TYPES,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Confirm that the information is accurate and belongs to you' }, { status: 400 });
  }

  const db = getServerSupabase();
  const { data } = await db.from('users').select(COLS).eq('id', user.sub).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const u = data as UserRow;
  if (u.identity_status === 'verified') {
    return NextResponse.json({ error: 'Your identity is already verified' }, { status: 409 });
  }
  const used = attemptsUsed(u);
  if (used >= MAX_ATTEMPTS_PER_DAY) {
    return NextResponse.json({ error: 'Too many attempts today. Try again tomorrow, or contact support.' }, { status: 429 });
  }

  // Count the attempt before calling the provider (each lookup is billed).
  const now = new Date().toISOString();
  await db.from('users').update({ identity_attempts: used + 1, identity_last_attempt_at: now }).eq('id', u.id);

  const fail = async (message: string, status = 400) => {
    await db.from('users').update({ identity_last_error: message }).eq('id', u.id);
    return NextResponse.json({ error: message, attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_DAY - used - 1) }, { status });
  };

  let identityType: 'nin' | 'cac';
  let identityName: string;
  let identityRef: string;

  if (body.type === 'nin') {
    const nin = String(body.nin ?? '').replace(/\D/g, '');
    const dob = String(body.dateOfBirth ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return fail('Enter your date of birth');
    const r = await lookupNin(nin);
    if (!r.ok) return fail(r.message, r.kind === 'config' || r.kind === 'unavailable' ? 503 : 400);
    if (r.record.dateOfBirth && r.record.dateOfBirth !== dob) {
      return fail('The date of birth doesn’t match the record for that NIN.');
    }
    // If a legal name was given at sign-up, the NIN must belong to that person.
    if (u.legal_name && !personNameMatches(r.record, u.legal_name)) {
      return fail(`The name on this NIN doesn’t match your legal name (${u.legal_name}). Check the NIN, or correct your legal name under Settings → Bank Details first.`);
    }
    identityType = 'nin';
    identityName = fullName(r.record);
    identityRef = `NIN ••••${nin.slice(-4)}`;
  } else if (body.type === 'cac') {
    const businessName = String(body.businessName ?? '').trim();
    const companyType = String(body.companyType ?? '') as CacCompanyType;
    if (!businessName) return fail('Enter your registered business name');
    const r = await lookupCac(String(body.rcNumber ?? ''), companyType);
    if (!r.ok) return fail(r.message, r.kind === 'config' || r.kind === 'unavailable' ? 503 : 400);
    if (r.record.status && /not\s*active|inactive|struck|dissolved/i.test(r.record.status)) {
      return fail(`CAC shows this registration as "${r.record.status}". Only active registrations can be verified.`);
    }
    if (!fullNamesMatch(r.record.companyName, businessName, { company: true })) {
      return fail(`The registered name for that number is "${r.record.companyName}", which doesn’t match what you entered.`);
    }
    identityType = 'cac';
    identityName = r.record.companyName;
    identityRef = `RC ${r.record.rcNumber}`;
  } else {
    return fail('Choose NIN or CAC verification');
  }

  // The verified name is now the legal name payouts are matched against.
  const bankMatched = u.account_name ? fullNamesMatch(u.account_name, identityName, { company: identityType === 'cac' }) : null;
  await db.from('users').update({
    verified: true,
    identity_status: 'verified',
    identity_type: identityType,
    identity_name: identityName,
    identity_ref: identityRef,
    identity_verified_at: now,
    identity_last_error: null,
    legal_name: identityName,
    bank_name_matched: bankMatched,
  }).eq('id', u.id);

  notify(
    { type: 'admin' },
    {
      notifType: 'kyc',
      title: 'Organiser identity verified',
      body: `${u.name} verified with ${identityType.toUpperCase()} (${identityRef}) as "${identityName}".${bankMatched === false ? ' Their bank account name does not match; payouts are paused until it does.' : ''}`,
      link: `/admin/organizers/${u.id}`,
    },
  ).catch(console.error);

  return NextResponse.json({ success: true, data: { status: 'verified', type: identityType, name: identityName, ref: identityRef, bankMatched } });
}
