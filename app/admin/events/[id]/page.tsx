'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { formatNGN, formatShortDate } from '@/lib/utils';

interface Tier { id: string; name: string; price: number; available: number; sold: number; }
interface TicketRow {
  id: string;
  buyer_name: string;
  buyer_email: string;
  tier_name: string;
  total_paid: number;
  refund_amount: number;
  status: string;
  purchased_at: string;
  has_reference: boolean;
  refunded_at: string | null;
  refunded_by: string | null;
  refund_reason: string | null;
}
interface EventDetail {
  id: string; event_name: string; slug: string | null; category: string; date: string; time: string;
  status: string; event_mode: 'physical' | 'online'; venue: string; city: string;
  organizer_id: string | null; organizer_name: string;
  organizerTotalSold: number; organizerTotalEvents: number;
  tiers: Tier[]; totalSold: number; totalRevenue: number;
  payoutReleased: boolean; tickets: TicketRow[];
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'valid':    return <Badge variant="green">Valid</Badge>;
    case 'used':     return <Badge variant="blue">Checked In</Badge>;
    case 'refunded': return <Badge variant="red">Refunded</Badge>;
    default:         return <Badge variant="gray">{status}</Badge>;
  }
};

export default function AdminEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [event, setEvent]     = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/events/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setEvent(d.data);
        else { toast(d.error || 'Event not found', 'error'); router.push('/admin/events'); }
      })
      .catch(() => toast('Failed to load event', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (id) load(); }, [id]);

  const refundableRows = useMemo(
    () => (event?.tickets ?? []).filter(t => t.status !== 'refunded'),
    [event],
  );

  const allSelected = refundableRows.length > 0 && refundableRows.every(t => selected.has(t.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(refundableRows.map(t => t.id)));
  };
  const toggleOne = (ticketId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId); else next.add(ticketId);
      return next;
    });
  };

  const selectedRows = (event?.tickets ?? []).filter(t => selected.has(t.id));
  const selectedTotal = selectedRows.reduce((s, t) => s + t.refund_amount, 0);

  const handleRefund = async () => {
    if (!event || selected.size === 0) return;
    setRefunding(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/refund-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketIds: Array.from(selected), reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Refund failed', 'error'); return; }
      const { refunded, failed } = data.data;
      if (failed === 0) {
        toast(`${refunded} ticket${refunded !== 1 ? 's' : ''} refunded`, 'success');
      } else {
        toast(`${refunded} refunded, ${failed} failed — see console for details`, 'error');
        console.error('Refund failures:', data.data.failures);
      }
      setSelected(new Set());
      setConfirming(false);
      setReason('');
      load();
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading event...</p>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/events" className="inline-flex items-center gap-1.5 text-sm mb-4"
          style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={14} />Back to Events
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
              {event.event_name}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {formatShortDate(event.date)} &bull; {event.event_mode === 'online' ? 'Online' : `${event.venue}, ${event.city}`} &bull; {event.organizer_name}
            </p>
            {event.organizer_id && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>
                This organiser has released <strong style={{ color: 'var(--color-text)' }}>{event.organizerTotalSold.toLocaleString()}</strong> ticket{event.organizerTotalSold !== 1 ? 's' : ''} across <strong style={{ color: 'var(--color-text)' }}>{event.organizerTotalEvents}</strong> event{event.organizerTotalEvents !== 1 ? 's' : ''} &mdash;{' '}
                <Link href={`/admin/organizers/${event.organizer_id}`} className="hover:underline" style={{ color: 'var(--color-purple-light)' }}>
                  view full profile
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {event.slug && (
              <a href={`/${event.slug}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-purple-light)' }}>
                View public page <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Tickets Sold', value: event.totalSold.toLocaleString() },
          { label: 'Revenue', value: formatNGN(event.totalRevenue) },
          { label: 'Payout Status', value: event.payoutReleased ? 'Released' : 'In Escrow' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border p-4"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{value}</p>
          </div>
        ))}
      </div>

      {event.tiers.length > 0 && (
        <div className="rounded-xl border p-5 flex flex-col gap-3"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Tiers</h2>
          <div className="flex flex-col gap-2">
            {event.tiers.map(tier => (
              <div key={tier.id} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--color-text)' }}>{tier.name}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {tier.sold} / {tier.available} sold &bull; {tier.price === 0 ? 'Free' : formatNGN(tier.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {event.payoutReleased && (
        <div className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: '#f59e0b30', backgroundColor: '#f59e0b10', color: 'var(--color-amber)' }}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          The payout for this event has already been released to the organiser. Funds are no longer held in
          escrow, so refunds can&apos;t be issued here — process any refund manually via the Paystack dashboard.
        </div>
      )}

      <div className="rounded-xl border overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between p-4 border-b flex-wrap gap-3"
          style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>
            Buyers {event.tickets.length > 0 && `(${event.tickets.length})`}
          </h2>
          {selected.size > 0 && !event.payoutReleased && (
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
              Refund Selected ({selected.size})
            </Button>
          )}
        </div>

        {event.tickets.length === 0 ? (
          <p className="text-sm p-4" style={{ color: 'var(--color-text-muted)' }}>No tickets sold yet.</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                {!event.payoutReleased && (
                  <Th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={refundableRows.length === 0}
                      className="w-4 h-4 rounded accent-[var(--color-purple)]"
                      aria-label="Select all refundable tickets"
                    />
                  </Th>
                )}
                <Th>Buyer</Th><Th>Tier</Th><Th>Amount</Th><Th>Purchased</Th><Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {event.tickets.map(t => (
                <Tr key={t.id}>
                  {!event.payoutReleased && (
                    <Td>
                      {t.status !== 'refunded' && (
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggleOne(t.id)}
                          className="w-4 h-4 rounded accent-[var(--color-purple)]"
                          aria-label={`Select ticket ${t.id}`}
                        />
                      )}
                    </Td>
                  )}
                  <Td>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{t.buyer_name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{t.buyer_email}</p>
                    </div>
                  </Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{t.tier_name}</span></Td>
                  <Td><span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatNGN(t.total_paid)}</span></Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(t.purchased_at.split('T')[0])}</span></Td>
                  <Td>
                    {statusBadge(t.status)}
                    {t.status === 'refunded' && t.refunded_by && (
                      <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-dim)' }}>
                        by {t.refunded_by} &middot; {t.refunded_at ? formatShortDate(t.refunded_at.split('T')[0]) : ''}
                      </p>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      <Modal open={confirming} onClose={() => !refunding && setConfirming(false)} title="Confirm Refund">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#ef444408', borderColor: '#ef444435' }}>
            <div className="flex gap-2 items-center mb-2">
              <AlertTriangle size={15} style={{ color: '#ef4444' }} />
              <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>This cannot be undone</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Refunding <strong style={{ color: 'var(--color-text)' }}>{selected.size}</strong> ticket{selected.size !== 1 ? 's' : ''}{' '}
              for a total of <strong style={{ color: 'var(--color-text)' }}>{formatNGN(selectedTotal)}</strong>. Each
              ticket is invalidated immediately and the buyer is emailed.
            </p>
          </div>
          <Textarea
            label="Reason (optional, kept on the audit record)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Buyer double-charged, event partially cancelled…"
            rows={2}
          />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth disabled={refunding} onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="danger" fullWidth disabled={refunding} onClick={handleRefund}>
              {refunding ? 'Refunding…' : 'Confirm Refund'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
