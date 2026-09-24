'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatNGN } from '@/lib/utils';
import {
  fmtDay, fmtPeriod, fmtDateTime, SettlementStatusBadge, ReleaseConfirmModal, ReleaseResults, postRelease,
  type ReleaseCandidate, type ReleaseOutcome,
} from '@/components/admin/settlementUi';

interface OrganizerPending {
  id: string; name: string; email: string;
  bankName: string | null; accountNumber: string | null; accountName: string | null;
  feeRate: number;
  releasable: {
    salesGross: number; refundsDeducted: number; gross: number; fee: number; net: number;
    ticketCount: number; periodStart: string; periodEnd: string;
  } | null;
  accruing: { eligibleOn: string; periodStart: string; periodEnd: string; net: number; ticketCount: number }[];
  refundsOwed: { gross: number; ticketCount: number };
  blockers: string[];
}

interface AttentionRow {
  id: string; organizer_id: string; organizer_name: string; kind: string;
  period_start: string; period_end: string; net: number; status: string;
  failure_reason: string | null; released_at: string; event_name: string | null;
}

interface Overview {
  today: string; cutoff: string; todayIsWorkingDay: boolean; nextWorkingDay: string;
  organizers: OrganizerPending[];
  attention: AttentionRow[];
}

export default function AdminPayoutsPage() {
  const [data, setData]         = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<ReleaseCandidate[]>([]);
  const [busy, setBusy]         = useState(false);
  const [results, setResults]   = useState<ReleaseOutcome[]>([]);
  const [rowBusy, setRowBusy]   = useState<string | null>(null);
  const [rowMsg, setRowMsg]     = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch('/api/admin/settlements', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success) { setData(d.data); setLoadError(''); }
        else setLoadError(d.error ?? 'Failed to load');
      })
      .catch(() => setLoadError('Network error'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const releasable = useMemo(
    () => (data?.organizers ?? []).filter(o => o.releasable && o.releasable.net > 0 && o.blockers.length === 0),
    [data],
  );
  const notReady = useMemo(
    () => (data?.organizers ?? []).filter(o => !releasable.includes(o)),
    [data, releasable],
  );
  const names = useMemo(
    () => Object.fromEntries((data?.organizers ?? []).map(o => [o.id, o.name])),
    [data],
  );
  const totalReleasable = releasable.reduce((s, o) => s + o.releasable!.net, 0);
  const selectedList = releasable.filter(o => selected.has(o.id));

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = releasable.length > 0 && selectedList.length === releasable.length;

  const candidate = (o: OrganizerPending): ReleaseCandidate => ({
    id: o.id, name: o.name, net: o.releasable!.net, period: fmtPeriod(o.releasable!.periodStart, o.releasable!.periodEnd),
  });

  const doRelease = async () => {
    if (busy) return;
    setBusy(true);
    const ids = confirming.map(c => c.id);
    const out = await postRelease(ids);
    setResults(out);
    setBusy(false);
    setConfirming([]);
    setSelected(new Set());
    load();
  };

  const rowAction = async (row: AttentionRow, action: 'retry' | 'verify') => {
    if (rowBusy) return;
    setRowBusy(row.id);
    try {
      const res = await fetch(`/api/admin/settlements/${row.id}/${action}`, { method: 'POST' });
      const d = await res.json();
      let msg = d.error ?? '';
      if (res.ok && action === 'verify') msg = d.data.message;
      if (res.ok && action === 'retry') {
        const r = d.data as ReleaseOutcome;
        msg = r.outcome === 'released' ? `Retry: ${r.settlement?.status}${r.settlement?.failure_reason ? ` — ${r.settlement.failure_reason}` : ''}` : (r.message ?? '');
      }
      setRowMsg(m => ({ ...m, [row.id]: msg }));
    } catch {
      setRowMsg(m => ({ ...m, [row.id]: 'Network error — refresh to check' }));
    }
    setRowBusy(null);
    load();
  };

  return (
    <div className="flex flex-col gap-5 pb-20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            Payouts
          </h1>
          {data && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {data.todayIsWorkingDay
                ? <>Sales up to {fmtDay(addDaysIso(data.cutoff, -1))} are releasable today.</>
                : <>Not a working day — new sales roll to {fmtDay(data.nextWorkingDay)}. Sales before {fmtDay(data.cutoff)} are releasable.</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link href="/admin/payouts/holidays" className="p-2 rounded-lg" aria-label="Holiday calendar"
            style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
            <CalendarDays size={16} />
          </Link>
          <button onClick={load} className="p-2 rounded-lg" aria-label="Refresh"
            style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loadError && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{loadError}</p>}
      {!data && !loadError && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}

      <ReleaseResults results={results} names={names} onDismiss={() => setResults([])} />

      {data && (
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Releasable now (net to organisers)</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            {formatNGN(totalReleasable)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
            {releasable.length} organiser{releasable.length === 1 ? '' : 's'} pending release
          </p>
        </div>
      )}

      {/* ── Needs attention: failed / in-flight ── */}
      {data && data.attention.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
            <AlertTriangle size={14} style={{ color: 'var(--color-amber)' }} /> Needs attention
          </h2>
          {data.attention.map(row => (
            <div key={row.id} className="rounded-xl border p-3 flex flex-col gap-2"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: row.status === 'failed' ? '#ef444450' : '#f59e0b50' }}>
              <Link href={`/admin/payouts/${row.organizer_id}`} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{row.organizer_name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {row.kind === 'legacy_escrow' ? `${row.event_name ?? 'Event'} (escrow payout)` : `Sales ${fmtPeriod(row.period_start, row.period_end)}`}
                    {' · '}{fmtDateTime(row.released_at)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatNGN(row.net)}</p>
                  <SettlementStatusBadge status={row.status} />
                </div>
              </Link>
              {row.failure_reason && (
                <p className="text-xs" style={{ color: row.status === 'failed' ? 'var(--color-red)' : 'var(--color-text-muted)' }}>{row.failure_reason}</p>
              )}
              {rowMsg[row.id] && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{rowMsg[row.id]}</p>}
              <div className="flex gap-2">
                {row.status === 'failed' && row.kind === 'daily' && (
                  <Button size="sm" variant="success" disabled={rowBusy === row.id} onClick={() => rowAction(row, 'retry')}>
                    <RefreshCw size={13} />{rowBusy === row.id ? 'Retrying…' : 'Retry'}
                  </Button>
                )}
                {(row.status === 'processing' || row.status === 'otp_pending') && (
                  <Button size="sm" variant="outline" disabled={rowBusy === row.id} onClick={() => rowAction(row, 'verify')}>
                    {rowBusy === row.id ? 'Checking…' : 'Check status'}
                  </Button>
                )}
                {row.status === 'otp_pending' && (
                  <a href="https://dashboard.paystack.com/#/transfers" target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink size={13} />Approve OTP</Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Pending release ── */}
      {data && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Pending release</h2>
            {releasable.length > 1 && (
              <button className="text-xs font-medium px-2 py-1" style={{ color: 'var(--color-purple-light)' }}
                onClick={() => setSelected(allSelected ? new Set() : new Set(releasable.map(o => o.id)))}>
                {allSelected ? 'Clear selection' : 'Select all'}
              </button>
            )}
          </div>
          {releasable.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nothing is waiting to be released.</p>
          )}
          {releasable.map(o => {
            const r = o.releasable!;
            const checked = selected.has(o.id);
            return (
              <div key={o.id} className="rounded-xl border p-3 flex items-stretch gap-3"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: checked ? 'var(--color-purple)' : 'var(--color-border)' }}>
                <label className="flex items-center pl-1 pr-1 -my-3 py-3 cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => toggle(o.id)}
                    className="w-5 h-5 accent-[var(--color-purple)]" aria-label={`Select ${o.name}`} />
                </label>
                <Link href={`/admin/payouts/${o.id}`} className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{o.name}</p>
                    <p className="text-base font-bold flex-shrink-0" style={{ color: 'var(--color-text)' }}>{formatNGN(r.net)}</p>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Sales {fmtPeriod(r.periodStart, r.periodEnd)} · {r.ticketCount} ticket{r.ticketCount === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                    Gross {formatNGN(r.gross)} · fee {formatNGN(r.fee)}
                    {r.refundsDeducted > 0 && <> · refunds −{formatNGN(r.refundsDeducted)}</>}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-dim)' }}>
                    {o.bankName} · {o.accountNumber}
                  </p>
                </Link>
                <div className="flex flex-col justify-center gap-1 flex-shrink-0">
                  <Button size="sm" variant="success" disabled={busy} onClick={() => setConfirming([candidate(o)])}>Release</Button>
                  <Link href={`/admin/payouts/${o.id}`} className="self-center p-1" aria-label="History" style={{ color: 'var(--color-text-dim)' }}>
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Not releasable yet / blocked ── */}
      {data && notReady.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Accruing or blocked</h2>
          {notReady.map(o => (
            <Link key={o.id} href={`/admin/payouts/${o.id}`} className="rounded-xl border p-3 flex items-center justify-between gap-3"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{o.name}</p>
                {o.blockers.map(b => (
                  <p key={b} className="text-xs" style={{ color: 'var(--color-red)' }}>{b}</p>
                ))}
                {o.releasable && o.blockers.length > 0 && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatNGN(o.releasable.net)} releasable once fixed</p>
                )}
                {o.accruing.map(a => (
                  <p key={a.eligibleOn} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {formatNGN(a.net)} releasable {fmtDay(a.eligibleOn)}
                  </p>
                ))}
              </div>
              <ChevronRight size={16} className="flex-shrink-0" style={{ color: 'var(--color-text-dim)' }} />
            </Link>
          ))}
        </section>
      )}

      {/* ── Sticky bulk bar (sits above the mobile bottom nav) ── */}
      {selectedList.length > 0 && (
        <div className="fixed left-0 right-0 z-40 px-3 lg:left-60 lg:px-8 bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] lg:bottom-4">
          <div className="rounded-xl border p-3 flex items-center justify-between gap-3 shadow-2xl"
            style={{ backgroundColor: 'var(--color-surface-2, var(--color-surface))', borderColor: 'var(--color-purple)' }}>
            <p className="text-sm min-w-0" style={{ color: 'var(--color-text)' }}>
              <span className="font-semibold">{selectedList.length}</span> selected ·{' '}
              <span className="font-semibold">{formatNGN(selectedList.reduce((s, o) => s + o.releasable!.net, 0))}</span>
            </p>
            <Button variant="success" disabled={busy} onClick={() => setConfirming(selectedList.map(candidate))}>
              Release {selectedList.length}
            </Button>
          </div>
        </div>
      )}

      <ReleaseConfirmModal candidates={confirming} busy={busy} onCancel={() => setConfirming([])} onConfirm={doRelease} />
    </div>
  );
}

function addDaysIso(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
