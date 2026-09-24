'use client';

import { CheckCircle, AlertCircle, Clock, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatNGN } from '@/lib/utils';

/** Calendar dates (YYYY-MM-DD) rendered at midday so no timezone shifts the day. */
export function fmtDay(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtPeriod(start: string, end: string) {
  return start === end ? fmtDay(start) : `${fmtDay(start)} – ${fmtDay(end)}`;
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function SettlementStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'successful':  return <Badge variant="green">Successful</Badge>;
    case 'processing':  return <Badge variant="amber">Processing</Badge>;
    case 'otp_pending': return <Badge variant="amber">OTP pending</Badge>;
    case 'failed':      return <Badge variant="red">Failed</Badge>;
    case 'void':        return <Badge variant="gray">Void</Badge>;
    case 'pending':     return <Badge variant="purple">Pending</Badge>;
    default:            return <Badge variant="gray">{status}</Badge>;
  }
}

export interface ReleaseCandidate { id: string; name: string; net: number; period: string }

export function ReleaseConfirmModal({
  candidates, busy, onCancel, onConfirm,
}: {
  candidates: ReleaseCandidate[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const total = candidates.reduce((s, c) => s + c.net, 0);
  return (
    <Modal open={candidates.length > 0} onClose={busy ? () => {} : onCancel}
      title={candidates.length === 1 ? 'Release settlement' : `Release ${candidates.length} settlements`}>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto">
          {candidates.map(c => (
            <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{c.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sales {c.period}</p>
              </div>
              <span className="font-semibold flex-shrink-0" style={{ color: 'var(--color-text)' }}>{formatNGN(c.net)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-3 text-sm" style={{ borderColor: 'var(--color-border)' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Total sent via Paystack</span>
          <span className="font-bold" style={{ color: 'var(--color-text)' }}>{formatNGN(total)}</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
          Amounts are after Ventry&apos;s fee. Anything already released is skipped automatically.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={onCancel} className="w-full sm:w-auto">Cancel</Button>
          <Button variant="success" disabled={busy} onClick={onConfirm} className="w-full sm:w-auto" size="lg">
            {busy ? 'Releasing…' : `Release ${formatNGN(total)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export interface ReleaseOutcome {
  organizerId: string;
  outcome: 'released' | 'noop' | 'blocked' | 'error';
  message?: string;
  settlement?: { status: string; net: number; failure_reason: string | null };
}

export function ReleaseResults({
  results, names, onDismiss,
}: {
  results: ReleaseOutcome[];
  names: Record<string, string>;
  onDismiss: () => void;
}) {
  if (results.length === 0) return null;
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Release results</p>
        <button onClick={onDismiss} aria-label="Dismiss" className="p-1" style={{ color: 'var(--color-text-dim)' }}><X size={16} /></button>
      </div>
      {results.map(r => {
        const s = r.settlement;
        let icon = <AlertCircle size={15} style={{ color: 'var(--color-red)' }} />;
        let text = r.message ?? '';
        if (r.outcome === 'released' && s) {
          if (s.status === 'successful') {
            icon = <CheckCircle size={15} style={{ color: 'var(--color-green)' }} />;
            text = `${formatNGN(s.net)} sent`;
          } else if (s.status === 'failed') {
            text = `Failed: ${s.failure_reason ?? 'unknown reason'} — retry from their history`;
          } else {
            icon = <Clock size={15} style={{ color: 'var(--color-amber)' }} />;
            text = s.status === 'otp_pending'
              ? `${formatNGN(s.net)} awaiting OTP in the Paystack dashboard`
              : `${formatNGN(s.net)} initiated — Paystack is processing it`;
          }
        } else if (r.outcome === 'noop') {
          icon = <CheckCircle size={15} style={{ color: 'var(--color-text-dim)' }} />;
        }
        return (
          <div key={r.organizerId} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex-shrink-0">{icon}</span>
            <p className="min-w-0" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{names[r.organizerId] ?? 'Organiser'}:</span> {text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export async function postRelease(organizerIds: string[]): Promise<ReleaseOutcome[]> {
  try {
    const res = await fetch('/api/admin/settlements/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizerIds }),
    });
    const d = await res.json();
    if (!res.ok) return organizerIds.map(id => ({ organizerId: id, outcome: 'error', message: d.error ?? 'Release failed' }));
    return d.data.results as ReleaseOutcome[];
  } catch {
    // The request may or may not have reached the server; the list reloads
    // afterwards, and a repeat release of the same period is a no-op anyway.
    return organizerIds.map(id => ({ organizerId: id, outcome: 'error', message: 'Network error — refresh to see what went through' }));
  }
}
