'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatNGN } from '@/lib/utils';
import type { EventPayoutSummary } from '@/lib/server/eventPayouts';

const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  successful: { label: 'Paid', color: 'var(--color-green)' },
  processing: { label: 'Sending', color: 'var(--color-amber)' },
  otp_pending: { label: 'Sending', color: 'var(--color-amber)' },
  failed: { label: 'Failed, being retried', color: 'var(--color-red)' },
};

/**
 * Every event with its own payout history: what it sold, what has been paid
 * out for it, what's still to come, and each payout that carried its tickets.
 * Used on the organiser's and the admin's payout pages.
 */
export function EventPayoutList({ events, admin = false }: { events: EventPayoutSummary[]; admin?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  if (events.length === 0) {
    return <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>No events yet.</p>;
  }

  return (
    <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
      {events.map(ev => {
        const upcoming = ev.date >= today && ev.status !== 'completed';
        const isOpen = open === ev.id;
        const free = ev.paidTickets === 0 && ev.freeTickets > 0;
        return (
          <li key={ev.id}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : ev.id)}
              aria-expanded={isOpen}
              className="w-full text-left px-4 sm:px-6 py-3.5 flex items-center gap-3 hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{ev.name}</p>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: upcoming ? 'var(--color-purple-dim)' : 'var(--color-surface-2)', color: upcoming ? 'var(--color-purple-light)' : 'var(--color-text-dim)' }}>
                    {upcoming ? 'Upcoming' : 'Past'}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {day(ev.date)} · {free ? `${ev.freeTickets} free tickets` : `${ev.paidTickets} ticket${ev.paidTickets === 1 ? '' : 's'} sold`}
                  {ev.pending > 0 && <> · <span style={{ color: 'var(--color-amber)' }}>{formatNGN(ev.pending)} to come</span></>}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{free ? '—' : formatNGN(ev.paidOut)}</p>
                <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>{free ? 'free event' : 'paid out'}</p>
              </div>
              <ChevronDown size={16} style={{ color: 'var(--color-text-dim)', transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
            </button>

            {isOpen && (
              <div className="px-4 sm:px-6 pb-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { l: 'Ticket sales', v: formatNGN(ev.sales) },
                    { l: 'Paid out to you', v: formatNGN(ev.paidOut) },
                    { l: 'Still to come', v: formatNGN(ev.pending) },
                    { l: 'Refunded', v: `${ev.refundedTickets} ticket${ev.refundedTickets === 1 ? '' : 's'}` },
                  ].map(x => (
                    <div key={x.l} className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>{x.l}</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{x.v}</p>
                    </div>
                  ))}
                </div>

                {ev.pending > 0 && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {formatNGN(ev.pending)} from {ev.pendingTickets} ticket{ev.pendingTickets === 1 ? '' : 's'} is still to be paid
                    {ev.nextPayoutOn ? `, from ${day(ev.nextPayoutOn)} (next working day after each sale)` : ''}.
                  </p>
                )}

                {ev.payouts.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {ev.payouts.map(p => {
                      const st = STATUS_LABEL[p.status] ?? { label: p.status, color: 'var(--color-text-muted)' };
                      return (
                        <li key={p.settlementId} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                          style={{ borderColor: 'var(--color-border)' }}>
                          <div className="min-w-0">
                            <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                              {when(p.date)} · {p.tickets} ticket{p.tickets === 1 ? '' : 's'}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                              {p.method === 'manual' ? 'Bank transfer' : 'Paystack transfer'}
                              {p.reference ? <> · <span className="font-mono">{admin ? p.reference : p.reference.slice(-10)}</span></> : null}
                              {p.shared ? ' · paid together with other events' : ''}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatNGN(p.amount)}</p>
                            <p className="text-[11px]" style={{ color: st.color }}>{st.label}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                    {free ? 'Free event: there is nothing to pay out.' : upcoming && ev.paidTickets === 0 ? 'No tickets sold yet.' : 'No payouts yet for this event.'}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
