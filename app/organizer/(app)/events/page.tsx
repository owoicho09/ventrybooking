'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatNGN, formatShortDate } from '@/lib/utils';

interface Tier { id: string; price: number; sold: number; available: number; }
interface OrgEvent {
  id: string; name: string; date: string; category: string; city: string;
  status: string; total_sold: number; tiers: Tier[];
}

const statusBadge = (status: string) => {
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

  useEffect(() => {
    fetch('/api/organizer/events')
      .then(r => r.json())
      .then(d => { if (d.success) setEvents(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>My Events</h1>
        <Link href="/organizer/events/create"><Button><Plus size={16} />New Event</Button></Link>
      </div>

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
                const netRevenue = Math.round(gross * 0.975);
                return (
                  <Tr key={event.id}>
                    <Td>
                      <p className="font-medium max-w-[200px] truncate" style={{ color: 'var(--color-text)' }}>{event.name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{event.city}</p>
                    </Td>
                    <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(event.date)}</span></Td>
                    <Td><span className="font-medium" style={{ color: 'var(--color-text)' }}>{formatNGN(netRevenue)}</span></Td>
                    <Td><TierBar tiers={event.tiers ?? []} /></Td>
                    <Td>{statusBadge(event.status)}</Td>
                    <Td>
                      <Link href={`/organizer/events/${event.id}`}>
                        <button className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                          style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-2)' }}>
                          <Settings2 size={13} />
                        </button>
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
