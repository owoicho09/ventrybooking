import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getIp } from '@/lib/server/rateLimit';

/**
 * New-device sign-in verification for organisers (migration 057).
 *
 * A browser holds a random secret in the HttpOnly `ventry_device` cookie.
 * Once an organiser confirms an emailed code on it, (organiser, that
 * secret's hash) is a trusted device and later sign-ins skip the code.
 */

export const DEVICE_COOKIE = 'ventry_device';
const DEVICE_DAYS = 365;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_CHALLENGES_PER_WINDOW = 3;
const WINDOW_MINUTES = 10;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const codeHash = (challengeId: string, code: string) => sha(`login:${challengeId}:${code}`);
const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function deviceSecret(req: NextRequest): string | null {
  const v = req.cookies.get(DEVICE_COOKIE)?.value ?? '';
  return /^[a-f0-9]{64}$/.test(v) ? v : null;
}

/** "Chrome on Windows", "Safari on iPhone"... good enough for an alert email. */
export function describeDevice(ua: string | null): string {
  const s = ua ?? '';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /SamsungBrowser/.test(s) ? 'Samsung Internet'
    : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'A browser';
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android'
    : /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'Mac' : /Linux/.test(s) ? 'Linux' : 'an unknown device';
  return `${browser} on ${os}`;
}

/** True when this browser is a live trusted device for this organiser. Touches last_used_at. */
export async function isTrustedDevice(db: SupabaseClient, userId: string, req: NextRequest): Promise<boolean> {
  const secret = deviceSecret(req);
  if (!secret) return false;
  const { data } = await db
    .from('organizer_trusted_devices')
    .select('id')
    .eq('user_id', userId).eq('token_hash', sha(secret))
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!data) return false;
  await db.from('organizer_trusted_devices').update({ last_used_at: new Date().toISOString(), ip: getIp(req.headers) }).eq('id', data.id);
  return true;
}

/**
 * Marks this browser trusted for the organiser and sets/refreshes the device
 * cookie on `res`. Reuses the browser's existing secret if it has one, so one
 * browser shared by two organiser accounts keeps a single cookie.
 */
export async function trustDevice(db: SupabaseClient, userId: string, req: NextRequest, res: NextResponse): Promise<void> {
  const secret = deviceSecret(req) ?? randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + DEVICE_DAYS * 86400_000).toISOString();
  const { error } = await db.from('organizer_trusted_devices').upsert({
    user_id: userId,
    token_hash: sha(secret),
    label: describeDevice(req.headers.get('user-agent')),
    ip: getIp(req.headers),
    last_used_at: new Date().toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
  }, { onConflict: 'user_id,token_hash' });
  if (error) console.error('trustDevice upsert error', error.message);
  res.cookies.set({
    name: DEVICE_COOKIE,
    value: secret,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DEVICE_DAYS * 86400,
  });
}

/** Starts a pending sign-in and returns the code to email. */
export async function createLoginChallenge(
  db: SupabaseClient, userId: string, req: NextRequest,
): Promise<{ ok: true; challengeId: string; code: string } | { ok: false; status: number; error: string }> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await db.from('organizer_login_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).gte('created_at', since);
  if ((count ?? 0) >= MAX_CHALLENGES_PER_WINDOW) {
    return { ok: false, status: 429, error: 'Too many sign-in codes requested. Wait a few minutes and try again.' };
  }
  const { data: row, error } = await db.from('organizer_login_challenges').insert({
    user_id: userId,
    code_hash: 'pending',
    ip: getIp(req.headers),
    label: describeDevice(req.headers.get('user-agent')),
    expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(),
  }).select('id').single();
  if (error || !row) {
    console.error('createLoginChallenge insert error', error?.message);
    return { ok: false, status: 500, error: 'Sign-in failed. Try again.' };
  }
  const code = randomInt(100000, 1000000).toString();
  await db.from('organizer_login_challenges').update({ code_hash: codeHash(row.id, code) }).eq('id', row.id);
  return { ok: true, challengeId: row.id, code };
}

/** Checks the emailed code; on success the challenge is used up and its organiser id returned. */
export async function verifyLoginChallenge(
  db: SupabaseClient, challengeId: unknown, rawCode: unknown,
): Promise<{ ok: true; userId: string; label: string | null; ip: string | null } | { ok: false; status: number; error: string }> {
  const id = String(challengeId ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, status: 400, error: 'Sign in again to get a new code.' };
  const code = String(rawCode ?? '').replace(/\D/g, '');
  const { data: row } = await db.from('organizer_login_challenges')
    .select('id, user_id, code_hash, attempts, expires_at, consumed_at, label, ip')
    .eq('id', id).maybeSingle();
  if (!row || row.consumed_at || new Date(row.expires_at) <= new Date()) {
    return { ok: false, status: 400, error: 'That code has expired. Sign in again to get a new one.' };
  }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, status: 429, error: 'Too many wrong codes. Sign in again to get a new one.' };

  if (code.length !== 6 || !safeEqual(codeHash(row.id, code), row.code_hash)) {
    await db.from('organizer_login_challenges').update({ attempts: row.attempts + 1 }).eq('id', row.id);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return { ok: false, status: 400, error: left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Sign in again to get a new one.' };
  }
  const { data: claimed } = await db.from('organizer_login_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id).is('consumed_at', null)
    .select('id');
  if (!claimed?.length) return { ok: false, status: 400, error: 'That code was already used. Sign in again.' };
  return { ok: true, userId: row.user_id, label: row.label, ip: row.ip };
}
