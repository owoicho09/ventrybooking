'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatShortDate } from '@/lib/utils';

interface FraudComplaint {
  id: string; type: string; buyer_name: string; buyer_email: string;
  event_name: string; submitted_at: string; priority: string; status: string; ticket_id: string;
}

export default function AdminFraudPage() {
  const [complaints, setComplaints] = useState<FraudComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/complaints')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setComplaints(d.data.filter((c: FraudComplaint) => c.type === 'Fraud' || c.priority === 'high'));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <ShieldAlert size={22} style={{ color: 'var(--color-red)' }} />
          <h1 className="text-2xl font-bold"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            Fraud Monitor
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          High-priority fraud complaints requiring immediate review.
        </p>
      </div>

      {!loading && complaints.length === 0 && (
        <div className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <ShieldAlert size={40} className="mx-auto mb-4" style={{ color: 'var(--color-text-dim)' }} />
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>No fraud alerts</p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No high-priority or fraud complaints at this time.</p>
        </div>
      )}

      {(loading || complaints.length > 0) && (
        <div className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <Table>
            <Thead>
              <tr>
                <Th>Type</Th><Th>Buyer</Th><Th>Event</Th><Th>Ticket ID</Th><Th>Submitted</Th><Th>Priority</Th><Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {complaints.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={13} style={{ color: 'var(--color-red)' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{c.type}</span>
                    </div>
                  </Td>
                  <Td>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--color-text)' }}>{c.buyer_name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{c.buyer_email}</p>
                    </div>
                  </Td>
                  <Td><p className="text-sm max-w-[160px] truncate" style={{ color: 'var(--color-text-muted)' }}>{c.event_name}</p></Td>
                  <Td><span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{c.ticket_id}</span></Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(c.submitted_at.split('T')[0])}</span></Td>
                  <Td><Badge variant="red">High</Badge></Td>
                  <Td>
                    {c.status === 'open' ? <Badge variant="red">Open</Badge> :
                      c.status === 'investigating' ? <Badge variant="amber">Investigating</Badge> :
                      c.status === 'resolved' ? <Badge variant="green">Resolved</Badge> :
                      <Badge variant="gray">{c.status}</Badge>}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
