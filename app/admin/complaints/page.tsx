'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatShortDate } from '@/lib/utils';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'payment', label: 'Payment' },
  { value: 'ticket_delivery', label: 'Ticket Delivery' },
  { value: 'refund_request', label: 'Refund Request' },
  { value: 'event_day', label: 'Event Day' },
  { value: 'event_inquiry', label: 'Event Inquiry' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'open': return <Badge variant="red">Open</Badge>;
    case 'investigating': return <Badge variant="amber">Investigating</Badge>;
    case 'resolved': return <Badge variant="green">Resolved</Badge>;
    case 'rejected': return <Badge variant="gray">Rejected</Badge>;
    default: return <Badge variant="gray">{status}</Badge>;
  }
};

const priorityBadge = (priority: string) => {
  switch (priority) {
    case 'high': return <Badge variant="red">High</Badge>;
    case 'medium': return <Badge variant="amber">Medium</Badge>;
    case 'low': return <Badge variant="gray">Low</Badge>;
    default: return null;
  }
};

interface ComplaintData {
  id: string; type: string; category?: string | null; buyer_name: string; buyer_email: string;
  event_name: string; submitted_at: string; priority: string; status: string;
  ticket_id: string | null; notes?: string; transcript?: unknown;
}

function transcriptText(transcript: unknown): { role: string; text: string }[] {
  try {
    const parsed = typeof transcript === 'string' ? JSON.parse(transcript) : transcript;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((m: { role: string; content: unknown }) => {
        const content = m.content;
        const text = typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content.filter((b: { type: string }) => b.type === 'text').map((b: { text?: string }) => b.text ?? '').join('\n')
            : '';
        return { role: m.role, text: text.trim() };
      })
      .filter(m => m.text);
  } catch {
    return [];
  }
}

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<ComplaintData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ComplaintData | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    if (categoryFilter) qs.set('category', categoryFilter);
    fetch(`/api/admin/complaints?${qs.toString()}`)
      .then(r => r.json())
      .then(d => { if (d.success) setComplaints(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter, categoryFilter]);

  const handleApproveRefund = async (id: string) => {
    setActing(true);
    await fetch(`/api/admin/complaints/${id}/approve-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    setActing(false);
    setSelected(null);
    setNotes('');
    load();
  };

  const handleReject = async (id: string) => {
    setActing(true);
    await fetch(`/api/admin/complaints/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    setActing(false);
    setSelected(null);
    setNotes('');
    load();
  };

  const handleSetStatus = async (id: string, status: string) => {
    setActing(true);
    await fetch(`/api/admin/complaints/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setActing(false);
    setSelected(null);
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          Complaint Queue
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Fraud complaints are prioritised first.
        </p>
      </div>

      <div className="flex gap-3 max-w-md">
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} />
        <Select options={CATEGORY_OPTIONS} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} />
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}
      {!loading && complaints.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No complaints found.</p>}

      {complaints.length > 0 && (
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <Table>
          <Thead>
            <tr>
              <Th>ID</Th><Th>Type</Th><Th>Buyer</Th><Th>Event</Th><Th>Submitted</Th><Th>Priority</Th><Th>Status</Th><Th>Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {complaints.map((complaint) => (
              <Tr key={complaint.id}>
                <Td><span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{complaint.id.slice(0, 8)}</span></Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    {complaint.type === 'Fraud' && <AlertTriangle size={13} style={{ color: 'var(--color-amber)' }} />}
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>{complaint.type}</span>
                  </div>
                </Td>
                <Td>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>{complaint.buyer_name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{complaint.buyer_email}</p>
                  </div>
                </Td>
                <Td><p className="text-sm max-w-[160px] truncate" style={{ color: 'var(--color-text-muted)' }}>{complaint.event_name}</p></Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(complaint.submitted_at.split('T')[0])}</span></Td>
                <Td>{priorityBadge(complaint.priority)}</Td>
                <Td>{statusBadge(complaint.status)}</Td>
                <Td>
                  <Button size="sm" variant="outline" onClick={() => { setSelected(complaint); setNotes(''); }}>
                    Review
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={`Complaint — ${selected?.type}`} width="520px">
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex gap-2 flex-wrap">
              {priorityBadge(selected.priority)}
              {statusBadge(selected.status)}
            </div>

            <div className="flex flex-col gap-3 text-sm">
              {[
                ['Complaint Type', selected.type],
                ['Category', selected.category || '—'],
                ['Ticket ID', selected.ticket_id || '—'],
                ['Buyer', selected.buyer_name],
                ['Buyer Email', selected.buyer_email],
                ['Event', selected.event_name],
                ['Submitted', formatShortDate(selected.submitted_at.split('T')[0])],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                  <span className="text-right font-medium" style={{ color: 'var(--color-text)' }}>{v}</span>
                </div>
              ))}
            </div>

            {transcriptText(selected.transcript).length > 0 && (
              <div className="rounded-lg border p-3 flex flex-col gap-2 max-h-60 overflow-y-auto"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Chat Transcript</p>
                {transcriptText(selected.transcript).map((m, i) => (
                  <p key={i} className="text-sm">
                    <span className="font-medium" style={{ color: m.role === 'user' ? 'var(--color-text)' : 'var(--color-purple-light)' }}>
                      {m.role === 'user' ? 'Buyer: ' : 'Agent: '}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{m.text}</span>
                  </p>
                ))}
              </div>
            )}

            <Textarea label="Resolution Notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Add resolution notes..." rows={3} />

            {(selected.status === 'open' || selected.status === 'investigating') && selected.ticket_id ? (
              <div className="flex gap-3">
                <Button variant="success" fullWidth disabled={acting} onClick={() => handleApproveRefund(selected.id)}>
                  <CheckCircle size={15} />Approve Refund
                </Button>
                <Button variant="danger" fullWidth disabled={acting} onClick={() => handleReject(selected.id)}>
                  <XCircle size={15} />Reject Claim
                </Button>
              </div>
            ) : (selected.status === 'open' || selected.status === 'investigating') ? (
              <div className="flex gap-3">
                {selected.status === 'open' && (
                  <Button variant="outline" fullWidth disabled={acting} onClick={() => handleSetStatus(selected.id, 'investigating')}>
                    <Clock size={15} />Mark Investigating
                  </Button>
                )}
                <Button variant="success" fullWidth disabled={acting} onClick={() => handleSetStatus(selected.id, 'resolved')}>
                  <CheckCircle size={15} />Mark Resolved
                </Button>
              </div>
            ) : (
              <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                This complaint has been {selected.status}.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
