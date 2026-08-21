'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatNGN, formatShortDate } from '@/lib/utils';

type Filter = 'all' | 'valid' | 'used' | 'refunded';

const filters: { value: Filter; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'valid',    label: 'Valid' },
  { value: 'used',     label: 'Used' },
  { value: 'refunded', label: 'Refunded' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'valid':    return <Badge variant="green">Valid</Badge>;
    case 'used':     return <Badge variant="blue">Used</Badge>;
    case 'refunded': return <Badge variant="red">Refunded</Badge>;
    default:         return <Badge variant="gray">{status}</Badge>;
  }
};

interface BuyerData {
  id: string;
  buyer_name: string;
  buyer_email: string;
  total_paid: number;
  status: string;
  purchased_at: string;
  paystack_reference: string;
  event_id: string;
  organizer_id: string;
  event_name: string;
  event_date: string | null;
  organizer_name: string;
}

function AdminBuyersPageInner() {
  const searchParams = useSearchParams();

  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [buyers, setBuyers] = useState<BuyerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);
  const [regenRef, setRegenRef] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeFilter !== 'all') params.set('status', activeFilter);
    if (search.trim()) params.set('search', search.trim());
    const qs = params.toString();

    fetch(`/api/admin/buyers${qs ? `?${qs}` : ''}`)
      .then(r => r.json())
      .then(d => { if (d.success) setBuyers(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const reconcile = useCallback(() => {
    setReconciling(true);
    setReconcileMsg(null);
    fetch('/api/admin/reconcile-orders', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setReconcileMsg('Reconcile failed.'); return; }
        setReconcileMsg(
          d.recovered.length > 0
            ? `Recovered ${d.recovered.length} missed ticket${d.recovered.length > 1 ? 's' : ''}.`
            : `Checked ${d.checked} stale checkout(s) — none missing.`,
        );
        if (d.recovered.length > 0) load();
      })
      .catch(() => setReconcileMsg('Reconcile failed.'))
      .finally(() => setReconciling(false));
  }, [load]);

  const regenerate = useCallback(() => {
    const reference = regenRef.trim();
    if (!reference) return;
    setRegenerating(true);
    setRegenMsg(null);
    fetch('/api/admin/regenerate-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.success) { setRegenMsg(d.error || 'Regenerate failed.'); return; }
        setRegenMsg(`Ticket ${d.ticketId} created.`);
        setRegenRef('');
        load();
      })
      .catch(() => setRegenMsg('Regenerate failed.'))
      .finally(() => setRegenerating(false));
  }, [regenRef, load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          Buyers
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Every ticket purchase across all events.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(({ value, label }) => (
            <button key={value} onClick={() => setActiveFilter(value)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: activeFilter === value ? 'var(--color-purple)' : 'var(--color-surface)',
                color:           activeFilter === value ? '#fff'               : 'var(--color-text-muted)',
                border:          `1px solid ${activeFilter === value ? 'var(--color-purple)' : 'var(--color-border)'}`,
              }}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <button onClick={reconcile} disabled={reconciling}
            title="Check for paid checkouts that never turned into a ticket (missed webhook)"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
            style={{
              backgroundColor: 'var(--color-surface)',
              color:           'var(--color-text-muted)',
              border:          '1px solid var(--color-border)',
            }}>
            <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} />
            {reconciling ? 'Checking...' : 'Recheck missed payments'}
          </button>

          <div className="w-full sm:w-72">
            <Input
              icon={<Search size={15} />}
              placeholder="Search name, email, or ticket ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Paystack reference (e.g. VTR-XXXXXXXXXXXX)"
            value={regenRef}
            onChange={(e) => setRegenRef(e.target.value)}
          />
        </div>
        <button onClick={regenerate} disabled={regenerating || !regenRef.trim()}
          title="Regenerate a ticket for one specific payment reference"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
          style={{
            backgroundColor: 'var(--color-surface)',
            color:           'var(--color-text-muted)',
            border:          '1px solid var(--color-border)',
          }}>
          <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? 'Regenerating...' : 'Regenerate ticket'}
        </button>
      </div>

      {reconcileMsg && (
        <p className="text-sm -mt-3" style={{ color: 'var(--color-text-muted)' }}>{reconcileMsg}</p>
      )}
      {regenMsg && (
        <p className="text-sm -mt-3" style={{ color: 'var(--color-text-muted)' }}>{regenMsg}</p>
      )}

      {loading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}
      {!loading && buyers.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No buyers found.</p>
      )}

      {buyers.length > 0 && (
        <div className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <Table>
            <Thead>
              <tr>
                <Th>Buyer</Th><Th>Event</Th><Th>Organizer</Th><Th>Event Date</Th>
                <Th>Price</Th><Th>Purchased</Th><Th>Status</Th><Th>Ticket ID</Th>
              </tr>
            </Thead>
            <Tbody>
              {buyers.map((buyer) => (
                <Tr key={buyer.id}>
                  <Td>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{buyer.buyer_name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{buyer.buyer_email}</p>
                    </div>
                  </Td>
                  <Td>
                    <Link href={`/admin/events/${buyer.event_id}`} className="text-sm max-w-[160px] truncate block hover:underline" style={{ color: 'var(--color-purple-light)' }}>
                      {buyer.event_name}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/admin/organizers/${buyer.organizer_id}`} className="text-sm max-w-[140px] truncate block hover:underline" style={{ color: 'var(--color-purple-light)' }}>
                      {buyer.organizer_name}
                    </Link>
                  </Td>
                  <Td>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {buyer.event_date ? formatShortDate(buyer.event_date) : '—'}
                    </span>
                  </Td>
                  <Td><span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatNGN(buyer.total_paid)}</span></Td>
                  <Td>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {formatShortDate(buyer.purchased_at.split('T')[0])}
                    </span>
                  </Td>
                  <Td>{statusBadge(buyer.status)}</Td>
                  <Td><span className="text-xs font-mono" style={{ color: 'var(--color-text-dim)' }}>{buyer.id}</span></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function AdminBuyersPage() {
  return (
    <Suspense fallback={<p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}>
      <AdminBuyersPageInner />
    </Suspense>
  );
}
