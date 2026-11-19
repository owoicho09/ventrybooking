'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Settings2, Trash2, FileEdit } from 'lucide-react';
import { listLocalDrafts, removeLocalDraft } from '@/lib/eventDrafts';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { isScheduled, isInactive, fmtGoLive } from '@/lib/goLive';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatNGN, formatShortDate } from '@/lib/utils';
import { PLATFORM_FEE_RATE } from '@/lib/fees';

interface Tier { id: string; price: number; sold: number; available: number; }
interface OrgEvent {
  id: string; name: string; date: string; category: string; city: string;
  status: string; total_sold: number; tiers: Tier[]; goes_live_at?: string | null;
  /** This event's host share of Ventry's fee (062); null = the account rate. */
  host_fee_rate?: number | null;
}

const statusBadge = (status: string, goesLiveAt?: string | null) => {
  if (status === 'approved' && isInactive(goesLiveAt)) {
    return <span title="Approved but hidden. Make it active from the event page."><Badge variant="gray">Inactive</Badge></span>;
  }
  if (status === 'approved' && isScheduled(goesLiveAt)) {
    return <span title={`Goes live ${fmtGoLive(goesLiveAt as string)}`}><Badge variant="amber">Live {fmtGoLive(goesLiveAt as string)}</Badge></span>;
  }
  switch (status) {
    case 'approved':    return <Badge variant="green">Approved</Badge>;
    case 'under_review': return <Badge variant="amber">Under Review</Badge>;
    case 'completed':   return <Badge variant="blue">Completed</Badge>;
    case 'draft':       return <Badge variant="gray">Draft</Badge>;
    case 'rejected':    return <Badge variant="red">Rejected</Badge>;
    default:            return <Badge variant="gray">{status}</Badge>;
  }
};

function TierBar({ tiers }: { tiers: Tier[] }) {
  const totalSold      = tiers.reduce((s, t) => s + t.sold, 0);
  const totalAvailable = tiers.reduce((s, t) => s + t.available, 0);
  if (totalAvailable === 0) return <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>—</span>;

  const pct        = Math.round((totalSold / totalAvailable) * 100);
  const isSoldOut  = totalSold >= totalAvailable;
  const isLowStock = !isSoldOut && (totalAvailable - totalSold) <= Math.max(5, Math.ceil(totalAvailable * 0.1));

  return (
    <div className="min-w-[100px]">
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {totalSold}/{totalAvailable}
        </span>
        {isSoldOut
          ? <Badge variant="gray">Sold Out</Badge>
          : isLowStock
          ? <Badge variant="amber">Low Stock</Badge>
          : null}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: isSoldOut
              ? 'var(--color-text-dim)'
              : isLowStock
              ? 'var(--color-amber)'
              : 'var(--color-purple)',
          }}
        />
      </div>
    </div>
  );
}

export default function OrganizerEventsPage() {
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFeeRate, setPlatformFeeRate] = useState(PLATFORM_FEE_RATE);
  const [toDelete, setToDelete] = useState<OrgEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [drafts, setDrafts] = useState<{ id: string; name: string; updatedAt: string }[]>([]);

  // Unfinished Create Event drafts: the account's (server) plus any that only
  // made it to this device (e.g. saved while signed out or offline).
  useEffect(() => {
    const local = listLocalDrafts();
    fetch('/api/organizer/event-drafts', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => (d?.success ? (d.data as { id: string; name: string; updated_at: string }[]) : []))
      .catch(() => [])
      .then(server => {
        const byId = new Map<string, { id: string; name: string; updatedAt: string }>();
        for (const s of server) byId.set(s.id, { id: s.id, name: s.name, updatedAt: s.updated_at });
        for (const l of local) {
          const s = byId.get(l.id);
          if (!s || l.updatedAt > s.updatedAt) byId.set(l.id, { ...l, name: l.name || s?.name || '' });
        }
        setDrafts([...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      });
  }, []);

  const deleteDraft = async (id: string) => {
    if (!window.confirm('Discard this draft? Everything you entered in it will be lost.')) return;
    setDrafts(prev => prev.filter(d => d.id !== id));
    removeLocalDraft(id);
    await fetch(`/api/organizer/event-drafts/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  // Only events with nothing sold get a delete button; the server re-checks
  // (tickets, payouts, in-flight checkouts) before removing anything.
  const canDelete = (e: OrgEvent) =>
    (e.total_sold ?? 0) === 0 && (e.tiers ?? []).every(t => (t.sold ?? 0) === 0);

  const closeDelete = () => { if (!deleting) { setToDelete(null); setDeleteError(''); } };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/organizer/events/${toDelete.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) {
        setDeleteError(d.error || 'Could not delete this event. Please try again.');
        return;
      }
      setEvents(prev => prev.filter(ev => ev.id !== toDelete.id));
      setToDelete(null);
    } catch {
      setDeleteError('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetch('/api/organizer/events', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEvents(d.data);
          if (typeof d.platformFeeRate === 'number') setPlatformFeeRate(d.platformFeeRate);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>My Events</h1>
        <Link href="/organizer/events/create"><Button><Plus size={16} />New Event</Button></Link>
      </div>

      {drafts.length > 0 && (
        <div className="rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="px-4 pt-3 pb-1 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Unfinished drafts <span className="font-normal" style={{ color: 'var(--color-text-dim)' }}>· not submitted yet</span>
          </p>
          <ul>
            {drafts.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{d.name || 'Untitled draft'}</p>
                  {d.updatedAt && (
                    <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                      Last saved {new Date(d.updatedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a href={`/organizer/events/create?draft=${d.id}`}>
                    <Button size="sm" variant="outline"><FileEdit size={13} />Continue</Button>
                  </a>
                  <button onClick={() => deleteDraft(d.id)} title="Discard draft" aria-label={`Discard draft ${d.name || ''}`}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ color: 'var(--color-red)', backgroundColor: 'var(--color-surface-2)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        {loading && <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading events...</p>}
        {!loading && events.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>No events yet. Create your first event!</p>
        )}
        {!loading && events.length > 0 && (
          <Table>
            <Thead>
              <tr><Th>Event</Th><Th>Date</Th><Th>Net Revenue</Th><Th>Ticket Sales</Th><Th>Status</Th><Th>Manage</Th></tr>
            </Thead>
            <Tbody>
              {events.map((event) => {
                const gross      = event.tiers?.reduce((s, t) => s + t.price * t.sold, 0) || 0;
                const netRevenue = Math.round(gross * (1 - (event.host_fee_rate == null ? platformFeeRate : Number(event.host_fee_rate))));
                return (
                  <Tr key={event.id}>
                    <Td>
                      <p className="font-medium max-w-[200px] truncate" style={{ color: 'var(--color-text)' }}>{event.name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{event.city}</p>
                    </Td>
                    <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(event.date)}</span></Td>
                    <Td><span className="font-medium" style={{ color: 'var(--color-text)' }}>{formatNGN(netRevenue)}</span></Td>
                    <Td><TierBar tiers={event.tiers ?? []} /></Td>
                    <Td>{statusBadge(event.status, event.goes_live_at)}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/organizer/events/${event.id}`}>
                          <button className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                            title="Manage event" aria-label="Manage event"
                            style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-2)' }}>
                            <Settings2 size={13} />
                          </button>
                        </Link>
                        {canDelete(event) && (
                          <button
                            onClick={() => { setDeleteError(''); setToDelete(event); }}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                            title="Delete event" aria-label={`Delete ${event.name}`}
                            style={{ color: 'var(--color-red)', backgroundColor: 'var(--color-surface-2)' }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>

      <Modal open={!!toDelete} onClose={closeDelete} title="Delete event?">
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{toDelete?.name}</span> and its ticket
            tiers will be permanently removed. No tickets have been sold, so no buyer is affected. This can&apos;t be undone.
          </p>
          {deleteError && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={deleting} onClick={closeDelete}>Keep event</Button>
            <Button variant="danger" size="sm" disabled={deleting} onClick={confirmDelete}>
              <Trash2 size={13} />{deleting ? 'Deleting...' : 'Delete event'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
