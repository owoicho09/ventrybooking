'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, ExternalLink, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatNGN } from '@/lib/utils';

interface AdminCase {
  id: string; kind: string; status: string; eventId: string; eventName: string; eventDate: string; reason: string | null;
  openedAt: string; claimsCloseAt: string; listSentAt: string | null; payBy: string | null;
  paidReportedAt: string | null; proofUrl: string | null; organizerNote: string | null; decisionNote: string | null; overdue: boolean;
  organizer: { id: string; name: string | null; email: string; hold: boolean; holdReason: string | null } | null;
  counts: { tickets: number; unclaimed: number; claimed: number; claimedTotal: number; autoRefunded: number; autoRefundedTotal: number };
  failedAutoRefunds: { id: string; ticketId: string; email: string; amount: number; error: string | null }[];
  claims: { ticketId: string; refundCode: string; buyerName: string | null; buyerEmail: string; amount: number; status: string; claimedAt: string | null; statement: string | null; payTo: string }[];
}

const KIND: Record<string, string> = { cancellation: 'Cancellation', postponement: 'Postponement', venue_change: 'Venue change', no_show: 'Act did not appear' };
const day = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

function badge(c: AdminCase) {
  if (c.overdue) return <Badge variant="red">Overdue</Badge>;
  const map: Record<string, [string, 'amber' | 'red' | 'green' | 'gray' | 'purple']> = {
    open: ['Claims open', 'amber'], verifying: ['Needs verification', 'purple'], list_sent: ['With organiser', 'amber'],
    paid_reported: ['Reported paid', 'green'], closed: ['No claims', 'gray'], rejected: ['Not upheld', 'gray'],
  };
  const [label, v] = map[c.status] ?? [c.status, 'gray'];
  return <Badge variant={v}>{label}</Badge>;
}

export default function AdminRefundsPage() {
  const { toast } = useToast();
  const [cases, setCases] = useState<AdminCase[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/refunds').then(r => r.json()).then(d => setCases(d.success ? d.data : [])).catch(() => setCases([]));
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/refunds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => null);
      if (!res.ok) { toast(d?.error ?? 'Failed', 'error'); return; }
      toast(ok, 'success');
      load();
    } finally { setBusy(false); }
  };

  const muted = { color: 'var(--color-text-muted)' };
  const needsAction = (cases ?? []).filter(c => c.overdue || c.status === 'verifying' || c.failedAutoRefunds.length);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Refunds</h1>
        <p className="text-sm mt-1" style={muted}>
          Claim windows, claim lists and what organisers owe. Ventry refunds only money it still held at cancellation; organisers pay every claim on their list.
        </p>
      </div>

      {needsAction.length > 0 && (
        <div className="rounded-lg border p-3 flex gap-2 text-sm" style={{ borderColor: '#f59e0b55', backgroundColor: '#f59e0b10', color: 'var(--color-text)' }}>
          <AlertTriangle size={16} style={{ color: '#f59e0b' }} className="shrink-0 mt-0.5" />
          {needsAction.length} case{needsAction.length === 1 ? ' needs' : 's need'} attention: overdue lists, no-show claims to verify, or failed Ventry refunds.
        </div>
      )}

      {cases === null && <p className="text-sm" style={muted}>Loading…</p>}
      {cases?.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <RotateCcw size={22} className="mx-auto mb-2" style={{ color: 'var(--color-text-dim)' }} />
          <p className="text-sm" style={muted}>No refund cases yet.</p>
        </div>
      )}

      {cases?.map(c => {
        const expanded = open === c.id;
        const canDecide = c.status === 'verifying' && new Date() >= new Date(c.claimsCloseAt);
        return (
          <div key={c.id} className="rounded-xl border p-5 flex flex-col gap-3" style={{ borderColor: c.overdue ? '#ef444466' : 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/admin/events/${c.eventId}`} className="font-semibold" style={{ color: 'var(--color-text)' }}>{c.eventName}</Link>
                <p className="text-xs mt-0.5" style={muted}>
                  {KIND[c.kind] ?? c.kind} · {c.organizer?.name ?? 'Organiser'} · opened {day(c.openedAt)}
                </p>
                {c.reason && <p className="text-xs mt-0.5" style={muted}>{c.reason}</p>}
              </div>
              {badge(c)}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs" style={muted}>Claimed</p><p className="font-semibold" style={{ color: 'var(--color-text)' }}>{c.counts.claimed} · {formatNGN(c.counts.claimedTotal)}</p></div>
              <div><p className="text-xs" style={muted}>Not claimed</p><p className="font-semibold" style={{ color: 'var(--color-text)' }}>{c.counts.unclaimed}</p></div>
              <div><p className="text-xs" style={muted}>Refunded by Ventry</p><p className="font-semibold" style={{ color: 'var(--color-text)' }}>{c.counts.autoRefunded} · {formatNGN(c.counts.autoRefundedTotal)}</p></div>
              <div>
                <p className="text-xs" style={muted}>{c.payBy ? 'Organiser pays by' : 'Claims close'}</p>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{day(c.payBy ?? c.claimsCloseAt)}</p>
              </div>
            </div>

            {c.failedAutoRefunds.length > 0 && (
              <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: '#ef444455' }}>
                <p className="text-sm font-medium" style={{ color: '#ef4444' }}>Ventry refunds that didn&apos;t go through</p>
                {c.failedAutoRefunds.map(f => (
                  <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span style={muted}>{f.ticketId} · {f.email} · {formatNGN(f.amount)} · {f.error}</span>
                    <span className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: 'retry', claimId: f.id }, 'Refunded')}>Retry</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ action: 'mark_refunded', claimId: f.id }, 'Marked refunded')}>Refunded by hand</Button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {c.status === 'verifying' && (
              <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                  Check with the organiser and, where needed, the venue whether the billed act appeared. {canDecide ? '' : `You can decide once claims close (${day(c.claimsCloseAt)}).`} The organiser&apos;s settlements are held meanwhile.
                </p>
                <textarea value={notes[c.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))} rows={2}
                  placeholder="What you found (sent to buyers if not upheld)" className="rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={!canDecide || busy} onClick={() => act({ action: 'decide', caseId: c.id, upheld: true, note: notes[c.id] }, 'Upheld: claim list sent to organiser')}>Uphold, send list</Button>
                  <Button size="sm" variant="outline" disabled={!canDecide || busy} onClick={() => act({ action: 'decide', caseId: c.id, upheld: false, note: notes[c.id] }, 'Rejected: buyers told')}>Not upheld</Button>
                </div>
              </div>
            )}

            {c.paidReportedAt && (
              <p className="text-sm" style={muted}>
                Reported paid {day(c.paidReportedAt)}.{' '}
                {c.proofUrl && <a href={c.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: 'var(--color-purple-light)' }}>Proof <ExternalLink size={12} /></a>}
                {c.organizerNote ? ` Note: ${c.organizerNote}` : ''}
              </p>
            )}

            {c.organizer && (
              <div className="flex flex-wrap items-center gap-3 text-xs" style={muted}>
                <span>Settlements: {c.organizer.hold ? <strong style={{ color: '#ef4444' }}>held{c.organizer.holdReason ? ` (${c.organizer.holdReason.startsWith('no_show:') ? 'no-show claims' : c.organizer.holdReason})` : ''}</strong> : 'running'}</span>
                <button type="button" disabled={busy} className="underline" style={{ color: 'var(--color-purple-light)' }}
                  onClick={() => act(
                    c.organizer!.hold ? { action: 'hold', organizerId: c.organizer!.id, hold: false } : { action: 'hold', organizerId: c.organizer!.id, hold: true, reason: c.overdue ? `Refunds overdue on ${c.eventName}` : `Refund claims on ${c.eventName}` },
                    c.organizer!.hold ? 'Settlements resumed' : 'Settlements held',
                  )}>
                  {c.organizer.hold ? 'Resume settlements' : 'Hold settlements'}
                </button>
              </div>
            )}

            {c.claims.length > 0 && (
              <button type="button" className="text-sm self-start" style={{ color: 'var(--color-purple-light)' }} onClick={() => setOpen(expanded ? null : c.id)}>
                {expanded ? 'Hide claims' : `Show ${c.claims.length} claim${c.claims.length === 1 ? '' : 's'}`}
              </button>
            )}
            {expanded && (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-xs">
                  <tbody>
                    {c.claims.map(r => (
                      <tr key={r.ticketId} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{r.buyerName || '—'}<div style={muted}>{r.buyerEmail}</div></td>
                        <td className="px-3 py-2" style={muted}>{r.ticketId}<div>{r.refundCode}</div></td>
                        <td className="px-3 py-2" style={muted}>{r.payTo}{r.statement && <div style={{ color: 'var(--color-text)' }}>{r.statement}</div>}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: 'var(--color-text)' }}>{formatNGN(r.amount)}<div style={muted}>{r.status}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
