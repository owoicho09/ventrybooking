'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatNGN, formatShortDate } from '@/lib/utils';

interface Tier { price: number; sold: number; }
interface OrgEvent { id: string; name: string; date: string; category: string; city: string; status: string; total_sold: number; tiers: Tier[]; }

const statusBadge = (status: string) => {
  switch (status) {
    case 'approved': return <Badge variant="green">Approved</Badge>;
    case 'under_review': return <Badge variant="amber">Under Review</Badge>;
    case 'completed': return <Badge variant="blue">Completed</Badge>;
    case 'draft': return <Badge variant="gray">Draft</Badge>;
    case 'rejected': return <Badge variant="red">Rejected</Badge>;
    default: return <Badge variant="gray">{status}</Badge>;
  }
};

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
        {!loading && events.length === 0 && <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>No events yet. Create your first event!</p>}
        {!loading && events.length > 0 && (
          <Table>
            <Thead>
              <tr><Th>Event</Th><Th>Date</Th><Th>Category</Th><Th>Net Revenue</Th><Th>Tickets</Th><Th>Status</Th><Th>Actions</Th></tr>
            </Thead>
            <Tbody>
              {events.map((event) => {
                const gross      = event.tiers?.reduce((s, t) => s + t.price * t.sold, 0) || 0;
                const netRevenue = Math.round(gross * 0.975); // after 2.5% platform fee
                return (
                  <Tr key={event.id}>
                    <Td>
                      <p className="font-medium max-w-[200px] truncate" style={{ color: 'var(--color-text)' }}>{event.name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{event.city}</p>
                    </Td>
                    <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(event.date)}</span></Td>
                    <Td><span style={{ color: 'var(--color-text-muted)' }}>{event.category}</span></Td>
                    <Td><span className="font-medium" style={{ color: 'var(--color-text)' }}>{formatNGN(netRevenue)}</span></Td>
                    <Td><span style={{ color: 'var(--color-text)' }}>{event.total_sold?.toLocaleString() ?? 0}</span></Td>
                    <Td>{statusBadge(event.status)}</Td>
                    <Td>
                      <Link href={`/events/${event.id}`}>
                        <button className="w-7 h-7 rounded-md flex items-center justify-center transition-colors" style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-2)' }}>
                          <Eye size={13} />
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
