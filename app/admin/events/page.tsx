'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Textarea } from '@/components/ui/Input';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatShortDate } from '@/lib/utils';

type Filter = 'all' | 'under_review' | 'approved' | 'rejected';

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'approved': return <Badge variant="green">Approved</Badge>;
    case 'under_review': return <Badge variant="amber">Under Review</Badge>;
    case 'rejected': return <Badge variant="red">Rejected</Badge>;
    case 'completed': return <Badge variant="blue">Completed</Badge>;
    default: return <Badge variant="gray">{status}</Badge>;
  }
};

interface EventData {
  id: string; name: string; category: string; date: string; city: string; venue: string;
  description: string; status: string;
  organizer: { name: string; tier?: string };
}

export default function AdminEventsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const load = () => {
    setLoading(true);
    const params = activeFilter !== 'all' ? `?status=${activeFilter}` : '';
    fetch(`/api/admin/events${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setEvents(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [activeFilter]);

  const handleApprove = async (id: string) => {
    setActing(true);
    await fetch(`/api/admin/events/${id}/approve`, { method: 'POST' });
    setActing(false);
    setSelectedEvent(null);
    load();
  };

  const handleReject = async (id: string) => {
    if (!reason.trim()) return;
    setActing(true);
    await fetch(`/api/admin/events/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setActing(false);
    setSelectedEvent(null);
    setRejecting(false);
    setReason('');
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        Event Approval Queue
      </h1>

      <div className="flex gap-1.5">
        {filters.map(({ value, label }) => (
          <button key={value} onClick={() => setActiveFilter(value)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: activeFilter === value ? 'var(--color-purple)' : 'var(--color-surface)',
              color: activeFilter === value ? '#fff' : 'var(--color-text-muted)',
              border: `1px solid ${activeFilter === value ? 'var(--color-purple)' : 'var(--color-border)'}`,
            }}>
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}
      {!loading && events.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No events found.</p>}

      {events.length > 0 && (
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <Table>
          <Thead>
            <tr>
              <Th>Event Name</Th><Th>Organizer</Th><Th>Type</Th><Th>Date</Th><Th>City</Th><Th>Status</Th><Th>Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {events.map((event) => (
              <Tr key={event.id}>
                <Td><p className="font-medium max-w-[200px] truncate" style={{ color: 'var(--color-text)' }}>{event.name}</p></Td>
                <Td>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>{event.organizer.name}</p>
                    {event.organizer.tier && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{event.organizer.tier}</p>}
                  </div>
                </Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{event.category}</span></Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(event.date)}</span></Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{event.city}</span></Td>
                <Td>{statusBadge(event.status)}</Td>
                <Td>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedEvent(event); setRejecting(false); setReason(''); }}>
                    Review
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
      )}

      <Drawer open={!!selectedEvent} onClose={() => setSelectedEvent(null)} title={selectedEvent?.name} width="520px">
        {selectedEvent && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 text-sm">
              {[
                ['Category', selectedEvent.category],
                ['Date', formatShortDate(selectedEvent.date)],
                ['Venue', selectedEvent.venue],
                ['City', selectedEvent.city],
                ['Organizer', selectedEvent.organizer.name],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--color-text)' }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg p-4 text-sm"
              style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
              {selectedEvent.description}
            </div>

            {statusBadge(selectedEvent.status)}

            {!rejecting ? (
              <div className="flex gap-3">
                <Button variant="success" fullWidth disabled={acting} onClick={() => handleApprove(selectedEvent.id)}>
                  <CheckCircle size={15} />Approve
                </Button>
                <Button variant="danger" fullWidth onClick={() => setRejecting(true)}>
                  <XCircle size={15} />Reject
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Textarea label="Rejection Reason" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this event is being rejected..." rows={3} />
                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setRejecting(false)}>Cancel</Button>
                  <Button variant="danger" fullWidth disabled={!reason.trim() || acting} onClick={() => handleReject(selectedEvent.id)}>
                    Confirm Rejection
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
