import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Emailed-code confirmation for organiser settings changes (migration 055).
 *
 *   1. requestChangeCode  -> 6-digit code emailed (to the account email, or
 *                            to a new email for an email change)
 *   2. verifyChangeCode   -> for 'settings', returns a grant token valid for
 *                            GRANT_MINUTES; every settings endpoint requires it
 *                            in the CHANGE_TOKEN_HEADER header
 *   3. requireChangeGrant -> used by each protected endpoint
 */

export const CHANGE_TOKEN_HEADER = 'x-ventry-change-token';
export const CHANGE_REQUIRED_CODE = 'CHANGE_VERIFICATION_REQUIRED';
export const GRANT_MINUTES = 10;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 3;
const WINDOW_MINUTES = 10;

export type ChangePurpose = 'settings' | 'email_new';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const codeHash = (purpose: ChangePurpose, userId: string, code: string) => sha(`change:${purpose}:${userId}:${code}`);

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function maskEmail(email: string): string {
  return email.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => a + '*'.repeat(Math.max(1, b.length)) + c);
}

/**
 * Creates (and returns, for emailing) a fresh code. Older unused codes for the
 * same purpose stop working. Limited to 3 codes per 10 minutes per purpose.
 */
export async function requestChangeCode(
  db: SupabaseClient,
  userId: string,
  purpose: ChangePurpose,
  targetEmail?: string,
): Promise<{ ok: true; code: string } | { ok: false; status: number; error: string }> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await db
    .from('organizer_change_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('purpose', purpose).gte('created_at', since);
  if ((count ?? 0) >= MAX_CODES_PER_WINDOW) {
    return { ok: false, status: 429, error: 'Too many codes requested. Wait a few minutes and try again.' };
  }

  const now = new Date().toISOString();
  await db.from('organizer_change_codes')
    .update({ expires_at: now })
    .eq('user_id', userId).eq('purpose', purpose).is('verified_at', null).gt('expires_at', now);

  const code = randomInt(100000, 1000000).toString();
  const { error } = await db.from('organizer_change_codes').insert({
    user_id: userId,
    purpose,
    code_hash: codeHash(purpose, userId, code),
    target_email: targetEmail ?? null,
    expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(),
  });
  if (error) {
    console.error('requestChangeCode insert error', error.message);
    return { ok: false, status: 500, error: 'Could not create a code. Try again.' };
  }
  return { ok: true, code };
}

/**
 * Checks a typed code against the latest live one. On success: 'settings'
 * gets a grant token; 'email_new' gets back the email the code was sent to.
 */
export async function verifyChangeCode(
  db: SupabaseClient,
  userId: string,
  purpose: ChangePurpose,
  rawCode: unknown,
): Promise<
  | { ok: true; grant?: string; grantExpiresAt?: string; targetEmail?: string | null }
  | { ok: false; status: number; error: string }
> {
  const code = String(rawCode ?? '').replace(/\D/g, '');
  const { data: row } = await db
    .from('organizer_change_codes')
    .select('id, code_hash, attempts, target_email')
    .eq('user_id', userId).eq('purpose', purpose)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return { ok: false, status: 400, error: 'That code has expired. Send a new one.' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, status: 429, error: 'Too many wrong codes. Send a new one.' };

  if (code.length !== 6 || !safeEqual(codeHash(purpose, userId, code), row.code_hash)) {
    await db.from('organizer_change_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return { ok: false, status: 400, error: left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Send a new one.' };
  }

  if (purpose === 'settings') {
    const grant = randomBytes(32).toString('hex');
    const grantExpiresAt = new Date(Date.now() + GRANT_MINUTES * 60_000).toISOString();
    const { data: claimed } = await db.from('organizer_change_codes')
      .update({ verified_at: new Date().toISOString(), grant_hash: sha(grant), grant_expires_at: grantExpiresAt })
      .eq('id', row.id).is('verified_at', null)
      .select('id');
    if (!claimed?.length) return { ok: false, status: 400, error: 'That code was already used. Send a new one.' };
    return { ok: true, grant, grantExpiresAt };
  }

  const { data: claimed } = await db.from('organizer_change_codes')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', row.id).is('verified_at', null)
    .select('id');
  if (!claimed?.length) return { ok: false, status: 400, error: 'That code was already used. Send a new one.' };
  return { ok: true, targetEmail: row.target_email };
}

/** True when the request carries a live grant belonging to this user. */
export async function hasChangeGrant(db: SupabaseClient, userId: string, req: NextRequest): Promise<boolean> {
  const token = req.headers.get(CHANGE_TOKEN_HEADER) ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const { data } = await db
    .from('organizer_change_codes')
    .select('id')
    .eq('user_id', userId).eq('purpose', 'settings')
    .eq('grant_hash', sha(token))
    .gt('grant_expires_at', new Date().toISOString())
    .maybeSingle();
  return !!data;
}

/** null when allowed; otherwise the 403 to return (the page then asks for a code). */
export async function requireChangeGrant(db: SupabaseClient, userId: string, req: NextRequest): Promise<NextResponse | null> {
  if (await hasChangeGrant(db, userId, req)) return null;
  return NextResponse.json(
    { error: 'Confirm it’s you with the code we email you, then try again.', code: CHANGE_REQUIRED_CODE },
    { status: 403 },
  );
}
