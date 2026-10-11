'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatNGN } from '@/lib/utils';

export interface IdentityStatus {
  status: 'unverified' | 'verified' | 'legacy';
  type: 'nin' | 'cac' | null;
  name: string | null;
  ref: string | null;
  verifiedAt: string | null;
  legalName: string | null;
  lastError: string | null;
  attemptsLeft: number;
  available: boolean;
  bank: { accountName: string | null; hasAccount: boolean; matched: boolean | null };
  settledTotal: number;
  cap: number;
  companyTypes: { value: string; label: string }[];
}

const field = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--color-purple)]';
const fieldStyle = { backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' } as const;

/**
 * The organiser's verification panel (Organiser Terms 3.2): identity status,
 * what's outstanding, and the NIN / CAC check through Dojah. Until verified,
 * settlement is capped at NGN 500,000 in total (3.7).
 */
export function VerificationPanel({ onChange }: { onChange?: (s: IdentityStatus) => void }) {
  const [s, setS] = useState<IdentityStatus | null>(null);
  const [mode, setMode] = useState<'nin' | 'cac'>('nin');
  const [nin, setNin] = useState('');
  const [dob, setDob] = useState('');
  const [rc, setRc] = useState('');
  const [companyType, setCompanyType] = useState('BUSINESS_NAME');
  const [businessName, setBusinessName] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch('/api/organizer/identity', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (d?.success) { setS(d.data); onChange?.(d.data); }
  }, [onChange]);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const body = mode === 'nin'
      ? { type: 'nin', nin: nin.replace(/\D/g, ''), dateOfBirth: dob, confirm }
      : { type: 'cac', rcNumber: rc, companyType, businessName, confirm };
    try {
      const res = await fetch('/api/organizer/identity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success) setError(d?.error ?? 'Verification failed. Please try again.');
      else { setNin(''); setDob(''); setRc(''); setOpen(false); }
      await load();
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!s) {
    return (
      <div className="rounded-xl border p-5 flex items-center gap-3 text-sm" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
        <Loader2 size={16} className="animate-spin" />Loading verification…
      </div>
    );
  }

  const verified = s.status === 'verified';
  const pct = Math.min(100, Math.round((s.settledTotal / s.cap) * 100));

  return (
    <section id="verification" className="rounded-xl border p-5 sm:p-6 flex flex-col gap-4"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: verified ? 'var(--color-border)' : 'var(--color-amber)' }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: verified ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)' }}>
          {verified ? <ShieldCheck size={20} color="#10b981" /> : <ShieldAlert size={20} color="#f59e0b" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {verified ? 'Identity verified' : 'Verify your identity'}
          </h2>
          {verified ? (
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {s.name} · {s.ref}{s.verifiedAt ? ` · ${new Date(s.verifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}. Buyers see a verified tick next to your name, and there&apos;s no cap on your payouts.
            </p>
          ) : (
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Individuals verify with their NIN; registered businesses with their CAC number. It takes about two minutes. Until then you can sell
              and be paid up to {formatNGN(s.cap)} in total, after which payouts pause until you verify.
              {s.status === 'legacy' && ' Your account still shows the older verified tick, but the payout limit applies until you complete this check.'}
            </p>
          )}
        </div>
      </div>

      {!verified && (
        <div>
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-dim)' }}>
            <span>Paid out so far</span><span>{formatNGN(s.settledTotal)} of {formatNGN(s.cap)}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? 'var(--color-red)' : 'var(--color-amber)' }} />
          </div>
          {pct >= 100 && <p className="text-xs mt-1.5" style={{ color: 'var(--color-red)' }}>Your payouts are paused until you verify. Your tickets keep selling.</p>}
        </div>
      )}

      {/* What's outstanding */}
      <ul className="flex flex-col gap-1.5 text-sm">
        <li style={{ color: verified ? 'var(--color-green)' : 'var(--color-text-muted)' }}>{verified ? '✓' : '○'} Identity checked (NIN or CAC)</li>
        <li style={{ color: s.bank.hasAccount ? 'var(--color-green)' : 'var(--color-text-muted)' }}>{s.bank.hasAccount ? '✓' : '○'} Payout bank account added</li>
        {s.bank.hasAccount && (
          <li style={{ color: s.bank.matched === false ? 'var(--color-red)' : s.bank.matched ? 'var(--color-green)' : 'var(--color-text-muted)' }}>
            {s.bank.matched === false ? '✕' : s.bank.matched ? '✓' : '○'} Account name {s.bank.accountName ? `"${s.bank.accountName}" ` : ''}
            {s.bank.matched === false ? 'doesn’t match your verified name. Add an account in your own name.' : s.bank.matched ? 'matches your name' : 'will be checked against your verified name'}
          </li>
        )}
      </ul>

      {!verified && !s.available && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
          Online verification is being switched on. You can keep selling in the meantime; we&apos;ll email you when it&apos;s ready.
        </p>
      )}

      {!verified && s.available && !open && (
        <Button onClick={() => setOpen(true)} className="self-start">Verify now</Button>
      )}

      {!verified && s.available && open && (
        <form onSubmit={submit} className="flex flex-col gap-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)' }} role="tablist">
            {([['nin', 'I’m an individual (NIN)'], ['cac', 'Registered business (CAC)']] as const).map(([m, label]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(''); }}
                className="rounded-md py-2 text-xs sm:text-sm font-medium"
                style={{ backgroundColor: mode === m ? 'var(--color-purple)' : 'transparent', color: mode === m ? '#fff' : 'var(--color-text-muted)' }}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'nin' ? (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span style={{ color: 'var(--color-text)' }}>National Identification Number (NIN)</span>
                <input className={field} style={fieldStyle} inputMode="numeric" autoComplete="off" maxLength={11} value={nin}
                  onChange={e => setNin(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="11 digits" required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span style={{ color: 'var(--color-text)' }}>Date of birth</span>
                <input className={field} style={fieldStyle} type="date" value={dob} onChange={e => setDob(e.target.value)} required />
              </label>
              {s.legalName && (
                <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                  The NIN must be in your legal name, <strong>{s.legalName}</strong>. If that&apos;s wrong, fix it under Bank Account below first.
                </p>
              )}
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span style={{ color: 'var(--color-text)' }}>Registered business name</span>
                <input className={field} style={fieldStyle} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Exactly as on your CAC certificate" required />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span style={{ color: 'var(--color-text)' }}>Registration type</span>
                  <select className={field} style={fieldStyle} value={companyType} onChange={e => setCompanyType(e.target.value)}>
                    {s.companyTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span style={{ color: 'var(--color-text)' }}>RC / BN number</span>
                  <input className={field} style={fieldStyle} value={rc} onChange={e => setRc(e.target.value)} placeholder="e.g. 1261103" required />
                </label>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Your payout account must then be in the business&apos;s registered name.</p>
            </>
          )}

          <label className="flex items-start gap-3 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[var(--color-purple)]" />
            <span>I confirm this information is accurate, complete and belongs to me. Submitting someone else&apos;s details is grounds for removal and may be reported.</span>
          </label>

          {error && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
            Checked by Dojah, a licensed verification provider. We keep only the name on record and the last 4 digits; never your full NIN or photo.
            {` ${s.attemptsLeft} attempt${s.attemptsLeft === 1 ? '' : 's'} left today.`}
          </p>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !confirm || s.attemptsLeft === 0}>{busy ? 'Checking…' : 'Verify'}</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}
