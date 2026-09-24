'use client';

import { useState, useEffect } from 'react';
import { Wallet, Edit3, CheckCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatNGN, formatShortDate } from '@/lib/utils';
import { NIGERIAN_BANKS } from '@/lib/banks';

interface Settlement {
  id: string; kind: 'daily' | 'legacy_escrow'; period_start: string; period_end: string;
  net: number; ticket_count: number; status: string; released_at: string; settled_at: string | null; event_name: string | null;
}
interface Upcoming { label: string; periodStart: string; periodEnd: string; net: number; eligibleOn: string | null; }

const statusBadge = (status: string) => {
  switch (status) {
    case 'successful':  return <Badge variant="green">Sent</Badge>;
    case 'processing':
    case 'otp_pending': return <Badge variant="amber">Sending</Badge>;
    case 'failed':      return <Badge variant="red">Delayed</Badge>;
    default:            return <Badge variant="gray">{status}</Badge>;
  }
};

const period = (a: string, b: string) => (a === b ? formatShortDate(a) : `${formatShortDate(a)} – ${formatShortDate(b)}`);

export default function PayoutsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [figures, setFigures] = useState<{ settled: number; pending: number } | null>(null);
  const [editingBank, setEditingBank] = useState(false);
  const [bank, setBank] = useState({ bankName: '', accountNumber: '', accountName: '', legalName: '' });
  const [bankMsg, setBankMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/organizer/payouts', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/organizer/me').then(r => r.json()),
    ]).then(([p, m]) => {
      if (p.success) {
        setSettlements(p.data.settlements);
        setUpcoming(p.data.upcoming);
        setFigures({ settled: p.data.fundsSettled, pending: p.data.fundsPending });
      }
      if (m.success) setBank({
        bankName: m.data.bank_name || '',
        accountNumber: m.data.account_number || '',
        accountName: m.data.account_name || '',
        legalName: m.data.legal_name || '',
      });
    }).catch(console.error);
  }, []);

  const saveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setBankMsg('');
    const res = await fetch('/api/organizer/bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bank) });
    const d = await res.json();
    setBankMsg(d.success ? 'Bank details saved.' : (d.error ?? 'Failed to save bank details'));
    setSaving(false);
    if (d.success) setEditingBank(false);
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Payouts</h1>

      <div className="rounded-xl border p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, #1a0a3d 0%, #0f0a2d 100%)', borderColor: '#7c3aed40' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(124,58,237,0.3)' }}>
            <Wallet size={20} color="#a855f7" />
          </div>
          <div className="min-w-0">
            <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Funds pending settlement</p>
            <p className="text-3xl sm:text-4xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>{figures ? formatNGN(figures.pending) : '—'}</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Each day&apos;s sales are released the next working day. Settled so far: <span className="text-white font-semibold">{figures ? formatNGN(figures.settled) : '—'}</span>
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>All amounts are your share, after Ventry&apos;s platform fee.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="px-4 sm:px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Settlement History</h2>
        </div>
        {upcoming.length === 0 && settlements.length === 0 && (
          <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>No settlements yet.</p>
        )}
        <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {upcoming.map(u => (
            <li key={`${u.periodStart}-${u.eligibleOn}`} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Sales {period(u.periodStart, u.periodEnd)}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {u.eligibleOn ? `Releasable ${formatShortDate(u.eligibleOn)}` : 'Ready — awaiting release'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatNGN(u.net)}</p>
                <Badge variant="gray">Pending</Badge>
              </div>
            </li>
          ))}
          {settlements.map(s => (
            <li key={s.id} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {s.kind === 'legacy_escrow' ? `${s.event_name ?? 'Event'} — final payout` : `Sales ${period(s.period_start, s.period_end)}`}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {s.kind === 'legacy_escrow' ? 'Paid after the event (previous payout model)' : `${s.ticket_count} ticket${s.ticket_count === 1 ? '' : 's'}`}
                  {' · '}{formatShortDate((s.settled_at ?? s.released_at).slice(0, 10))}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatNGN(s.net)}</p>
                {statusBadge(s.status)}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border p-4 flex items-start gap-3"
        style={{ backgroundColor: '#f59e0b10', borderColor: '#f59e0b40' }}>
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-amber)' }} />
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>Cancellation policy:</span>{' '}
          If you cancel an event, all buyers are refunded their base ticket price. The 3% platform fee is non-recoverable — Ventry absorbs the refund processing cost but you forfeit any claim to the fee on cancelled sales.
        </p>
      </div>

      <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Bank Account</h2>
          <button onClick={() => setEditingBank(!editingBank)} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
            <Edit3 size={14} />{editingBank ? 'Cancel' : 'Edit Bank Details'}
          </button>
        </div>

        {!editingBank ? (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm"><span style={{ color: 'var(--color-text-muted)' }}>Bank Name</span><span className="font-medium" style={{ color: 'var(--color-text)' }}>{bank.bankName || '—'}</span></div>
            <div className="flex justify-between text-sm"><span style={{ color: 'var(--color-text-muted)' }}>Account Number</span><span className="font-mono font-medium" style={{ color: 'var(--color-text)' }}>{bank.accountNumber ? `****${bank.accountNumber.slice(-4)}` : '—'}</span></div>
            <div className="flex justify-between text-sm"><span style={{ color: 'var(--color-text-muted)' }}>Legal Name</span><span className="font-medium" style={{ color: 'var(--color-text)' }}>{bank.legalName || '—'}</span></div>
            {bank.accountNumber && <div className="flex items-center gap-2 mt-1"><CheckCircle size={14} style={{ color: 'var(--color-green)' }} /><span className="text-xs" style={{ color: 'var(--color-green)' }}>Verified account</span></div>}
          </div>
        ) : (
          <form onSubmit={saveBank} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Bank Name</label>
              <select
                value={bank.bankName}
                onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))}
                required
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--color-purple)]"
                style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="" disabled>Select your bank</option>
                {NIGERIAN_BANKS.map(b => (
                  <option key={b.code} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            <Input label="Account Number" value={bank.accountNumber} onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))} placeholder="10-digit account number" maxLength={10} />
            <Input label="Account Name" value={bank.accountName} onChange={e => setBank(b => ({ ...b, accountName: e.target.value }))} placeholder="Name as on bank account" />
            <Input
              label="Legal Name"
              value={bank.legalName}
              onChange={e => setBank(b => ({ ...b, legalName: e.target.value }))}
              placeholder="Your legal name exactly as it appears on your bank account"
              helper="This is never shown to buyers — your display name is what they see. It's used to match your settlement bank account."
            />
            {bankMsg && <p className="text-xs" style={{ color: bankMsg.includes('saved') ? 'var(--color-green)' : 'var(--color-red)' }}>{bankMsg}</p>}
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Bank Details'}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
