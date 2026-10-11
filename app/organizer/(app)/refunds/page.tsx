'use client';

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Upload, Download } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatNGN } from '@/lib/utils';

interface Claim {
  ticketId: string; refundCode: string; buyerName: string | null; amount: number; status: string;
  bankName: string | null; accountNumber: string | null; accountName: string | null;
}
interface RefundCase {
  id: string; kind: string; status: string; eventName: string; eventDate: string; reason: string | null;
  openedAt: string; claimsCloseAt: string; cancelDays: number; listSentAt: string | null; payBy: string | null;
  paidReportedAt: string | null; overdue: boolean; claimedCount: number; claimedTotal: number;
  ventryRefunded: { ticketId: string; amount: number }[]; claims: Claim[];
}

const KIND: Record<string, string> = {
  cancellation: 'Cancelled', postponement: 'Postponed', venue_change: 'Venue changed', no_show: 'Act did not appear',
};
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });

function statusBadge(c: RefundCase) {
  if (c.overdue) return <Badge variant="red">Overdue</Badge>;
  switch (c.status) {
    case 'open': return <Badge variant="amber">Claims open</Badge>;
    case 'verifying': return <Badge variant="amber">Being verified</Badge>;
    case 'list_sent': return <Badge variant="red">Pay by {day(c.payBy!)}</Badge>;
    case 'paid_reported': return <Badge variant="green">Reported paid</Badge>;
    case 'closed': return <Badge variant="gray">No claims</Badge>;
    case 'rejected': return <Badge variant="gray">Not upheld</Badge>;
    default: return <Badge variant="gray">{c.status}</Badge>;
  }
}

function csvFor(c: RefundCase) {
  const q = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Buyer', 'Ticket ID', 'Refund ID', 'Amount (NGN)', 'Bank', 'Account number', 'Account name'].map(q).join(',')];
  for (const r of c.claims) rows.push([r.buyerName, r.ticketId, r.refundCode, r.amount, r.bankName, r.accountNumber, r.accountName].map(q).join(','));
  return rows.join('\n');
}

export default function OrganizerRefundsPage() {
  const { toast } = useToast();
  const [cases, setCases] = useState<RefundCase[] | null>(null);
  const [proof, setProof] = useState<Record<string, File | null>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/organizer/refunds').then(r => r.json()).then(d => setCases(d.success ? d.data : [])).catch(() => setCases([]));
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const download = (c: RefundCase) => {
    const blob = new Blob([csvFor(c)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `refund-claims-${c.eventName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const reportPaid = async (c: RefundCase) => {
    const file = proof[c.id];
    if (!file) return;
    setBusy(c.id);
    try {
      const fd = new FormData();
      fd.append('proof', file);
      fd.append('note', note[c.id] ?? '');
      const res = await fetch(`/api/organizer/refunds/${c.id}/paid`, { method: 'POST', body: fd });
      const d = await res.json().catch(() => null);
      if (!res.ok) { toast(d?.error ?? 'Failed', 'error'); return; }
      toast('Reported paid. Buyers have been told.', 'success');
      load();
    } finally { setBusy(null); }
  };

  const muted = { color: 'var(--color-text-muted)' };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Refunds</h1>
        <p className="text-sm mt-1" style={muted}>
          When an event is cancelled, or changed where your policy offers a refund, buyers claim through Ventry for 30 days. You then get one list of everyone who claimed and pay each buyer directly within the days you published. Report it here with proof of payment.
        </p>
      </div>

      {cases === null && <p className="text-sm" style={muted}>Loading…</p>}
      {cases?.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <RotateCcw size={22} className="mx-auto mb-2" style={{ color: 'var(--color-text-dim)' }} />
          <p className="text-sm" style={muted}>No refund claims on your events.</p>
        </div>
      )}

      {cases?.map(c => (
        <div key={c.id} className="rounded-xl border p-5 flex flex-col gap-4" style={{ borderColor: c.overdue ? '#ef444466' : 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{c.eventName}</p>
              <p className="text-xs mt-0.5" style={muted}>{KIND[c.kind] ?? c.kind} · opened {day(c.openedAt)}{c.reason ? ` · ${c.reason}` : ''}</p>
            </div>
            {statusBadge(c)}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs" style={muted}>Claims</p><p className="font-semibold" style={{ color: 'var(--color-text)' }}>{c.claimedCount}</p></div>
            <div><p className="text-xs" style={muted}>Total to refund</p><p className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatNGN(c.claimedTotal)}</p></div>
            <div>
              <p className="text-xs" style={muted}>{c.status === 'open' || c.status === 'verifying' ? 'Claims close' : 'Pay by'}</p>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {c.status === 'open' || c.status === 'verifying' ? day(c.claimsCloseAt) : c.payBy ? day(c.payBy) : '—'}
              </p>
            </div>
          </div>

          {(c.status === 'open' || c.status === 'verifying') && (
            <p className="text-xs" style={muted}>
              You&apos;ll receive the full list, with each buyer&apos;s bank details, when claims close. You then have {c.cancelDays} days to pay.
            </p>
          )}
          {c.ventryRefunded.length > 0 && (
            <p className="text-xs" style={muted}>
              Ventry already refunded {c.ventryRefunded.length} ticket{c.ventryRefunded.length === 1 ? '' : 's'} ({formatNGN(c.ventryRefunded.reduce((s, r) => s + r.amount, 0))}) from money it still held. Don&apos;t pay those again.
            </p>
          )}

          {c.claims.length > 0 && (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                    <th className="text-left px-3 py-2">Buyer</th><th className="text-left px-3 py-2">Pay to</th><th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {c.claims.map(r => (
                    <tr key={r.ticketId} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{r.buyerName || '—'}<div style={muted}>{r.ticketId} · {r.refundCode}</div></td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{r.accountName}<div style={muted}>{r.bankName} {r.accountNumber}</div></td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: 'var(--color-text)' }}>{formatNGN(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {c.claims.length > 0 && (
            <button type="button" onClick={() => download(c)} className="inline-flex items-center gap-1.5 text-sm font-medium self-start" style={{ color: 'var(--color-purple-light)' }}>
              <Download size={14} /> Download the list (CSV)
            </button>
          )}

          {c.status === 'list_sent' && (
            <div className="rounded-lg border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Paid everyone on the list?</p>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer self-start" style={{ color: 'var(--color-purple-light)' }}>
                <Upload size={14} /> {proof[c.id]?.name ?? 'Upload proof of payment'}
                <input type="file" className="sr-only" accept=".pdf,image/*" onChange={e => setProof(p => ({ ...p, [c.id]: e.target.files?.[0] ?? null }))} />
              </label>
              <textarea
                value={note[c.id] ?? ''} onChange={e => setNote(n => ({ ...n, [c.id]: e.target.value }))} rows={2} maxLength={1000}
                placeholder="Note for Ventry (optional), e.g. transfer references"
                className="rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
              <Button disabled={!proof[c.id] || busy === c.id} onClick={() => reportPaid(c)}>
                {busy === c.id ? 'Sending…' : 'Report refunds paid'}
              </Button>
              <p className="text-xs" style={muted}>A bank statement or the transfer receipts covering every buyer on the list. Ventry tells each buyer you&apos;ve reported it paid.</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
