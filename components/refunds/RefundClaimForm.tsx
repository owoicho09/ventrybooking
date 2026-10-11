'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { NIGERIAN_BANKS } from '@/lib/banks';
import { formatNGN } from '@/lib/utils';

type Mode = 'refund' | 'no_show';
interface Started {
  claimId: string; sentTo: string; eventName: string; amount: number; kind: string; closesAt: string;
  acts?: { name: string; liability: string }[];
}

const KIND_TEXT: Record<string, string> = {
  cancellation: 'The event was cancelled.',
  postponement: 'The event was postponed. Claiming gives up your ticket for the new date.',
  venue_change: 'The event moved venue. Claiming gives up your ticket.',
  no_show: 'A billed act did not appear.',
};

const fieldStyle = { backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' };

export function RefundClaimForm({ initialTicket, initialCode, initialMode }: { initialTicket: string; initialCode: string; initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [ticketId, setTicketId] = useState(initialTicket);
  const [refundCode, setRefundCode] = useState(initialCode);
  const [email, setEmail] = useState('');
  const [started, setStarted] = useState<Started | null>(null);
  const [code, setCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [act, setAct] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneName, setDoneName] = useState<string | null>(null);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/refunds/claim/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, ticketId, refundCode, email }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success) { setError(d?.error ?? 'Something went wrong'); return; }
      setStarted(d.data);
      if (d.data.acts?.length === 1) setAct(d.data.acts[0].name);
    } finally { setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!started) return;
    setBusy(true); setError('');
    try {
      const statement = started.kind === 'no_show' ? `Did not appear: ${act}${details ? `. ${details}` : ''}` : null;
      const res = await fetch('/api/refunds/claim/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: started.claimId, code, bankName, accountNumber, statement }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success) { setError(d?.error ?? 'Something went wrong'); return; }
      setDoneName(d.data.accountName);
    } finally { setBusy(false); }
  };

  const card = 'rounded-xl border p-5 sm:p-6 flex flex-col gap-4';
  const cardStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' };
  const muted = { color: 'var(--color-text-muted)' };

  if (doneName && started) {
    const closes = new Date(started.closesAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' });
    return (
      <div className={card} style={cardStyle}>
        <CheckCircle2 size={28} style={{ color: '#10b981' }} />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Claim recorded</h2>
        <p className="text-sm" style={muted}>
          Your claim for {formatNGN(started.amount)} on <strong>{started.eventName}</strong> will be paid to {doneName}.{' '}
          {started.kind === 'no_show'
            ? 'Ventry is checking what happened with the organiser and the venue, and will email you the outcome.'
            : `When the claim window closes (${closes}), the organiser gets the full list and pays you directly. We’ll email you the date they must pay by.`}
        </p>
        <p className="text-sm" style={muted}>We&apos;ve emailed you a confirmation. Keep it.</p>
      </div>
    );
  }

  if (started) {
    return (
      <form onSubmit={submit} className={card} style={cardStyle}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{started.eventName}</p>
          <p className="text-sm" style={muted}>
            {KIND_TEXT[started.kind] ?? ''} Refund due: <strong style={{ color: 'var(--color-text)' }}>{formatNGN(started.amount)}</strong> (the ticket price; fees aren&apos;t refundable).
          </p>
        </div>
        <Input label={`Code sent to ${started.sentTo}`} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit code" required />
        {started.kind === 'no_show' && started.acts && (
          <>
            <label className="flex flex-col gap-1.5 text-sm" style={{ color: 'var(--color-text)' }}>
              Who did not appear?
              <select value={act} onChange={e => setAct(e.target.value)} required className="rounded-lg border px-3 py-2.5 text-sm" style={fieldStyle}>
                <option value="">Choose…</option>
                {started.acts.map(a => <option key={a.name} value={a.name}>{a.name}{a.liability === 'headliner' ? ' (Headliner)' : ''}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm" style={{ color: 'var(--color-text)' }}>
              What happened? (optional)
              <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} maxLength={800} className="rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1.5 text-sm" style={{ color: 'var(--color-text)' }}>
          Your bank
          <select value={bankName} onChange={e => setBankName(e.target.value)} required className="rounded-lg border px-3 py-2.5 text-sm" style={fieldStyle}>
            <option value="">Choose your bank…</option>
            {NIGERIAN_BANKS.map(b => <option key={b.code + b.name} value={b.name}>{b.name}</option>)}
          </select>
        </label>
        <Input label="Account number" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10 digits" required />
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
          We check the account name with your bank. These details go only to the organiser, to pay this refund.
        </p>
        {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}
        <Button type="submit" disabled={busy || code.length !== 6 || !bankName || accountNumber.length !== 10 || (started.kind === 'no_show' && !act)}>
          {busy ? 'Submitting…' : 'Submit claim'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={start} className={card} style={cardStyle}>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {(['refund', 'no_show'] as const).map(m => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(''); }}
            className="rounded-lg border px-3 py-2 text-left"
            style={{
              borderColor: mode === m ? 'var(--color-purple)' : 'var(--color-border)',
              backgroundColor: mode === m ? 'color-mix(in srgb, var(--color-purple) 10%, transparent)' : 'transparent',
              color: 'var(--color-text)',
            }}>
            {m === 'refund' ? 'Cancelled or changed event' : 'A billed act didn’t appear'}
          </button>
        ))}
      </div>
      <Input label="Ticket ID" value={ticketId} onChange={e => setTicketId(e.target.value.toUpperCase())} placeholder="TKT-XXXX-XXXX" required />
      {mode === 'refund' ? (
        <Input label="Refund ID" value={refundCode} onChange={e => setRefundCode(e.target.value.toUpperCase())} placeholder="RF-XXXX-XXXX" helper="In the email we sent about the cancellation or change." required />
      ) : (
        <>
          <Input label="Email you bought with" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
            Claims must be made within 24 hours after the event ends. The Headliner is always covered; other acts only if the organiser&apos;s refund policy says so.
          </p>
        </>
      )}
      {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}
      <Button type="submit" disabled={busy || !ticketId || (mode === 'refund' ? !refundCode : !email)}>
        {busy ? 'Checking…' : 'Email me a code'}
      </Button>
    </form>
  );
}
