'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * "Confirm it's you" for organiser settings (055).
 *
 *   const { secure, secureModal } = useSecureChange();
 *   const res = await secure(headers => fetch(url, { method, headers: { ...headers, ... }, body }));
 *   if (!res) return;            // they closed the code window
 *   {secureModal}                // render once on the page
 *
 * The first change the server marks as protected emails a 6-digit code; once it's verified, the
 * grant lasts 10 minutes (shared across tabs of this session via
 * sessionStorage), so several changes in a row need only one code.
 */

const HEADER = 'x-ventry-change-token';
const STORE = 'ventry_change_grant';
const REQUIRED = 'CHANGE_VERIFICATION_REQUIRED';

type Grant = { token: string; expiresAt: number };

function readGrant(): Grant | null {
  try {
    const g = JSON.parse(sessionStorage.getItem(STORE) || 'null') as Grant | null;
    return g && g.token && g.expiresAt > Date.now() + 15_000 ? g : null;
  } catch { return null; }
}
function writeGrant(g: Grant | null) {
  try { if (g) sessionStorage.setItem(STORE, JSON.stringify(g)); else sessionStorage.removeItem(STORE); } catch { /* storage off */ }
}

export function useSecureChange() {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((token: string | null) => void) | null>(null);
  const memGrant = useRef<Grant | null>(null);

  const currentGrant = () => {
    const g = memGrant.current && memGrant.current.expiresAt > Date.now() + 15_000 ? memGrant.current : readGrant();
    memGrant.current = g;
    return g;
  };

  const askForCode = useCallback(() => new Promise<string | null>(resolve => {
    resolver.current = resolve;
    setOpen(true);
  }), []);

  const finish = useCallback((grant: Grant | null) => {
    if (grant) { memGrant.current = grant; writeGrant(grant); }
    setOpen(false);
    resolver.current?.(grant?.token ?? null);
    resolver.current = null;
  }, []);

  const secure = useCallback(async (action: (headers: Record<string, string>) => Promise<Response>): Promise<Response | null> => {
    // Ask for a code only when the server says this change needs one: name,
    // phone, password, email, bank details etc. do; a profile picture, bio
    // or notification switch doesn't.
    let token: string | null = currentGrant()?.token ?? null;
    let res = await action(token ? { [HEADER]: token } : {});
    if (res.status === 403) {
      const body = await res.clone().json().catch(() => null);
      if (body?.code === REQUIRED) {
        memGrant.current = null; writeGrant(null);
        token = await askForCode();
        if (!token) return null;
        res = await action({ [HEADER]: token });
      }
    }
    return res;
  }, [askForCode]);

  const secureModal = <SecureCodeModal open={open} onDone={finish} />;
  return { secure, secureModal };
}

function SecureCodeModal({ open, onDone }: { open: boolean; onDone: (g: Grant | null) => void }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const send = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/organizer/settings/code', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || 'Could not send the code'); return; }
      setSentTo(d.data.sentTo);
      setCooldown(30);
    } catch {
      setErr('Network error. Try again.');
    } finally { setBusy(false); }
  }, []);

  // Send a code as soon as the window opens (once per opening, even when
  // React runs effects twice in development); reset when it closes.
  const sentForThisOpen = useRef(false);
  useEffect(() => {
    if (!open) { sentForThisOpen.current = false; return; }
    if (sentForThisOpen.current) return;
    sentForThisOpen.current = true;
    setCode(''); setErr(''); setSentTo(null);
    send();
  }, [open, send]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setErr('Enter the 6-digit code'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/organizer/settings/code/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || 'That code didn’t work'); return; }
      onDone({ token: d.data.token, expiresAt: new Date(d.data.expiresAt).getTime() });
    } catch {
      setErr('Network error. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={() => !busy && onDone(null)} title="Confirm it's you">
      <form onSubmit={verify} className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-purple-light)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            To keep your account safe, every settings change is confirmed with a code.{' '}
            {sentTo ? <>We emailed a 6-digit code to <strong style={{ color: 'var(--color-text)' }}>{sentTo}</strong>.</> : busy ? 'Sending a code to your email…' : null}
          </p>
        </div>
        <input
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }}
          inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000" aria-label="6-digit code"
          className="w-full rounded-lg border px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none"
          style={{ backgroundColor: 'var(--color-surface-2)', borderColor: err ? 'var(--color-red)' : 'var(--color-border)', color: 'var(--color-text)' }}
        />
        {err && <p className="text-sm" role="alert" style={{ color: 'var(--color-red)' }}>{err}</p>}
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
          Once confirmed, you can keep making changes for 10 minutes without another code.
        </p>
        <div className="flex gap-3">
          <Button type="submit" disabled={busy || code.length !== 6}>{busy && sentTo ? 'Checking…' : 'Confirm'}</Button>
          <Button type="button" variant="outline" disabled={busy || cooldown > 0} onClick={send}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
