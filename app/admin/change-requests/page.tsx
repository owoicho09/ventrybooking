'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatShortDate } from '@/lib/utils';

interface ChangeRequest {
  id: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  organizerName: string;
  organizerEmail: string;
  changeType: 'venue' | 'date' | 'venue_and_date';
  oldValue: Record<string, string>;
  newValue: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

function ValueSummary({ value }: { value: Record<string, string> }) {
  return (
    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
      {value.date && <div>{value.date} {value.time}</div>}
      {value.venue && <div>{value.venue}{value.city ? `, ${value.city}` : ''}</div>}
    </div>
  );
}

export default function AdminChangeRequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/change-requests')
      .then(r => r.json())
      .then(d => { if (d.success) setRequests(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setActingId(id);
    try {
      await fetch(`/api/admin/change-requests/${id}/approve`, { method: 'POST' });
      load();
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id: string) => {
    setActingId(id);
    try {
      await fetch(`/api/admin/change-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectingId(null);
      setRejectReason('');
      load();
    } finally {
      setActingId(null);
    }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const decided = requests.filter(r => r.status !== 'pending');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Change Requests</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Venue/date changes beyond an organiser&apos;s first 2 included changes on an event — nothing here has touched the live event or notified a buyer yet.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : pending.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No pending change requests.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map(r => (
            <div key={r.id} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    <Link href={`/${r.eventSlug}`} target="_blank" className="hover:underline">{r.eventName}</Link>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>{r.organizerName} ({r.organizerEmail}) &middot; requested {formatShortDate(r.requestedAt)}</p>
                  <Badge variant="amber">{r.changeType.replace('_', ' + ')}</Badge>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-dim)' }}>Current</p>
                    <ValueSummary value={r.oldValue} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-dim)' }}>Requested</p>
                    <ValueSummary value={r.newValue} />
                  </div>
                </div>
              </div>

              {rejectingId === r.id ? (
                <div className="mt-4 flex flex-col gap-2">
                  <Textarea placeholder="Reason (optional, shown to the organiser)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={actingId === r.id} onClick={() => reject(r.id)}>
                      {actingId === r.id ? 'Rejecting…' : 'Confirm Reject'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" disabled={actingId === r.id} onClick={() => approve(r.id)}>
                    {actingId === r.id ? 'Approving…' : 'Approve'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={actingId === r.id} onClick={() => setRejectingId(r.id)}>Reject</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Reviewed</h2>
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>Event</Th>
                  <Th>Organiser</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reviewed</Th>
                </Tr>
              </Thead>
              <Tbody>
                {decided.map(r => (
                  <Tr key={r.id}>
                    <Td>{r.eventName}</Td>
                    <Td>{r.organizerName}</Td>
                    <Td>{r.changeType.replace('_', ' + ')}</Td>
                    <Td>{r.status === 'approved' ? <Badge variant="green">Approved</Badge> : <Badge variant="red">Rejected</Badge>}</Td>
                    <Td className="text-xs">{r.reviewedAt ? formatShortDate(r.reviewedAt) : '—'} {r.reviewedBy ? `by ${r.reviewedBy}` : ''}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
