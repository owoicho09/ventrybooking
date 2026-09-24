'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNGN } from '@/lib/utils';
import {
  fmtDay, fmtPeriod, fmtDateTime, SettlementStatusBadge, ReleaseConfirmModal, ReleaseResults, postRelease,
  type ReleaseCandidate, type ReleaseOutcome,
} from '@/components/admin/settlementUi';

interface Attempt {
  attempt_no: number; transfer_reference: string; amount: number; initiated_by: string | null;
  initiated_at: string; status: string; paystack_status: string | null; failure_reason: string | null; finished_at: string | null;
}

interface Settlement {
  id: string; kind: 'daily' | 'legacy_escrow'; period_start: string; period_end: string;
  gross: number; refunds_deducted: number; fee: number; net: number; fee_rate: number; ticket_count: number;
  status: string; failure_reason: string | null; transfer_reference: string | null;
  released_by: string | null; released_at: string; settled_at: string | null; event_name: string | null;
  attempts: Attempt[];
}

interface History {
  organizer: { id: string; name: string; email: string; bankName: string | null; accountNumber: string | null; accountName: string | null; feeRate: number };
  pending: {
    releasable: { salesGross: number; refundsDeducted: number; gross: number; fee: number; net: number; ticketCount: number; periodStart: string; periodEnd: string } | null;
    accruing: { eligibleOn: string; periodStart: string; periodEnd: string; gross: number; fee: number; net: number; ticketCount: number }[];
    refundsOwed: { gross: number; ticketCount: number };
  };
  blockers: string[];
  settlements: Settlement[];
}

function Amounts({ gross, fee, net, refunds }: { gross: number; fee: number; net: number; refunds?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs mt-2">
      <div>
        <p style={{ color: 'var(--color-text-dim)' }}>Gross{refunds ? ' (after refunds)' : ''}</p>
        <p className="font-medium" style={{ color: 'var(--color-text)' }}>{formatNGN(gross)}</p>
      </div>
      <div>
        <p style={{ color: 'var(--color-text-dim)' }}>Fee</p>
        <p className="font-medium" style={{ color: 'var(--color-text)' }}>{formatNGN(fee)}</p>
      </div>
      <div className="text-right">
        <p style={{ color: 'var(--color-text-dim)' }}>Net</p>
        <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{formatNGN(net)}</p>
      </div>
    </div>
  );
}

export default function OrganizerSettlementHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<ReleaseCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ReleaseOutcome[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch(`/api/admin/settlements/organizers/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.success) { setData(d.data); setError(''); } else setError(d.error ?? 'Failed to load'); })
      .catch(() => setError('Network error'));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doRelease = async () => {
    if (busy) return;
    setBusy(true);
    setResults(await postRelease([id]));
    setBusy(false);
    setConfirming([]);
    load();
  };

  const rowAction = async (s: Settlement, action: 'retry' | 'verify') => {
    if (rowBusy) return;
    setRowBusy(s.id);
    try {
      const res = await fetch(`/api/admin/settlements/${s.id}/${action}`, { method: 'POST' });
      const d = await res.json();
      let msg = d.error ?? '';
      if (res.ok && action === 'verify') msg = d.data.message;
      if (res.ok && action === 'retry') {
        const r = d.data as ReleaseOutcome;
        msg = r.outcome === 'released' ? `Retry sent — now ${r.settlement?.status}` : (r.message ?? '');
      }
      setRowMsg(m => ({ ...m, [s.id]: msg }));
    } catch {
      setRowMsg(m => ({ ...m, [s.id]: 'Network error — refresh to check' }));
    }
    setRowBusy(null);
    load();
  };

  const org = data?.organizer;
  const rel = data?.pending.releasable;
  const canRelease = !!rel && rel.net > 0 && (data?.blockers.length ?? 1) === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin/payouts" className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={15} /> Payouts
        </Link>
        <button onClick={load} className="p-2 rounded-lg" aria-label="Refresh"
          style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
      {!data && !error && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}

      {org && (
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>{org.name}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{org.email}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {org.bankName ?? 'No bank'} · {org.accountNumber ?? '—'} · {org.accountName ?? '—'}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Platform fee {(org.feeRate * 100).toFixed(1)}%</p>
        </div>
      )}

      <ReleaseResults results={results} names={org ? { [org.id]: org.name } : {}} onDismiss={() => setResults([])} />

      {data && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Settlement history</h2>

          {/* Pending — releasable now */}
          {rel && (
            <div className="rounded-xl border p-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-purple)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Sales {fmtPeriod(rel.periodStart, rel.periodEnd)}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {rel.ticketCount} ticket{rel.ticketCount === 1 ? '' : 's'} · not yet released
                    {rel.refundsDeducted > 0 && <> · sales {formatNGN(rel.salesGross)} less {formatNGN(rel.refundsDeducted)} refunded after earlier settlements</>}
                  </p>
                </div>
                <SettlementStatusBadge status="pending" />
              </div>
              <Amounts gross={rel.gross} fee={rel.fee} net={rel.net} refunds={rel.refundsDeducted} />
              {data.blockers.map(b => <p key={b} className="text-xs mt-2" style={{ color: 'var(--color-red)' }}>{b}</p>)}
              <Button className="mt-3" fullWidth variant="success" disabled={!canRelease || busy}
                onClick={() => setConfirming([{ id: org!.id, name: org!.name, net: rel.net, period: fmtPeriod(rel.periodStart, rel.periodEnd) }])}>
                Release {formatNGN(rel.net)}
              </Button>
            </div>
          )}

          {/* Pending — not yet eligible */}
          {data.pending.accruing.map(a => (
            <div key={a.eligibleOn} className="rounded-xl border p-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Sales {fmtPeriod(a.periodStart, a.periodEnd)}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {a.ticketCount} ticket{a.ticketCount === 1 ? '' : 's'} · releasable {fmtDay(a.eligibleOn)}
                  </p>
                </div>
                <Badge variant="gray">Accruing</Badge>
              </div>
              <Amounts gross={a.gross} fee={a.fee} net={a.net} />
            </div>
          ))}

          {!rel && data.pending.refundsOwed.gross > 0 && (
            <p className="text-xs" style={{ color: 'var(--color-amber)' }}>
              {formatNGN(data.pending.refundsOwed.gross)} of refunds on already-settled tickets will be deducted from the next release.
            </p>
          )}

          {data.settlements.length === 0 && !rel && data.pending.accruing.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No settlements yet.</p>
          )}

          {data.settlements.map(s => (
            <div key={s.id} className="rounded-xl border p-3" style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: s.status === 'failed' ? '#ef444450' : 'var(--color-border)',
            }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {s.kind === 'legacy_escrow' ? (
                    <>
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{s.event_name ?? 'Event'} — final payout</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Escrow model · paid after the event ({fmtDay(s.period_start)})</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Sales {fmtPeriod(s.period_start, s.period_end)}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.ticket_count} ticket{s.ticket_count === 1 ? '' : 's'} · daily settlement</p>
                    </>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <SettlementStatusBadge status={s.status} />
                  {s.kind === 'legacy_escrow' && <Badge variant="gray">Escrow</Badge>}
                </div>
              </div>

              <Amounts gross={s.gross} fee={s.fee} net={s.net} refunds={s.refunds_deducted} />
              {s.refunds_deducted > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>
                  Includes −{formatNGN(s.refunds_deducted)} for tickets refunded after an earlier settlement.
                </p>
              )}

              <div className="text-xs mt-2 flex flex-col gap-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {s.kind === 'daily'
                  ? <p>Released {fmtDateTime(s.released_at)} by {s.released_by ?? '—'}</p>
                  : <p>Released {fmtDateTime(s.released_at)} (before daily settlement)</p>}
                {s.settled_at && <p>Confirmed by Paystack {fmtDateTime(s.settled_at)}</p>}
                {s.transfer_reference && <p className="font-mono break-all" style={{ color: 'var(--color-text-dim)' }}>{s.transfer_reference}</p>}
                {s.kind === 'legacy_escrow' && (
                  <p style={{ color: 'var(--color-text-dim)' }}>Amount shown is the recorded escrow net; any partial-release percentage applied at the time isn&apos;t recorded.</p>
                )}
              </div>

              {s.failure_reason && (
                <p className="text-xs mt-2" style={{ color: s.status === 'failed' ? 'var(--color-red)' : 'var(--color-text-muted)' }}>
                  {s.failure_reason}
                </p>
              )}
              {rowMsg[s.id] && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{rowMsg[s.id]}</p>}

              {(s.kind === 'daily' && s.status === 'failed') || s.status === 'processing' || s.status === 'otp_pending' ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {s.kind === 'daily' && s.status === 'failed' && (
                    <Button size="sm" variant="success" disabled={rowBusy === s.id} onClick={() => rowAction(s, 'retry')}>
                      <RefreshCw size={13} />{rowBusy === s.id ? 'Retrying…' : `Retry ${formatNGN(s.net)}`}
                    </Button>
                  )}
                  {(s.status === 'processing' || s.status === 'otp_pending') && (
                    <Button size="sm" variant="outline" disabled={rowBusy === s.id} onClick={() => rowAction(s, 'verify')}>
                      {rowBusy === s.id ? 'Checking…' : 'Check status'}
                    </Button>
                  )}
                  {s.status === 'otp_pending' && (
                    <a href="https://dashboard.paystack.com/#/transfers" target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline"><ExternalLink size={13} />Approve OTP</Button>
                    </a>
                  )}
                </div>
              ) : null}

              {s.attempts?.length > 1 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-purple-light)' }}>{s.attempts.length} transfer attempts</summary>
                  <ul className="mt-1 flex flex-col gap-1">
                    {[...s.attempts].sort((a, b) => a.attempt_no - b.attempt_no).map(a => (
                      <li key={a.transfer_reference} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        #{a.attempt_no} · {formatNGN(a.amount)} · {a.status}{a.paystack_status ? ` (${a.paystack_status})` : ''} · {fmtDateTime(a.initiated_at)} by {a.initiated_by ?? '—'}
                        {a.failure_reason && <> — {a.failure_reason}</>}
                        <span className="block font-mono break-all" style={{ color: 'var(--color-text-dim)' }}>{a.transfer_reference}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </section>
      )}

      <ReleaseConfirmModal candidates={confirming} busy={busy} onCancel={() => setConfirming([])} onConfirm={doRelease} />
    </div>
  );
}
