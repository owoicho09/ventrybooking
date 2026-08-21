'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Textarea } from '@/components/ui/Input';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatShortDate } from '@/lib/utils';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

const filters: { value: Filter; label: string }[] = [
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved & Sent' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all',      label: 'All' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'pending':  return <Badge variant="amber">Pending</Badge>;
    case 'approved': return <Badge variant="green">Sent</Badge>;
    case 'rejected': return <Badge variant="red">Rejected</Badge>;
    default:         return <Badge variant="gray">{status}</Badge>;
  }
};

interface NewsletterData {
  id: string; subject: string; body: string; image_urls: string[]; status: string;
  rejection_reason: string | null; recipient_count: number | null;
  submitted_at: string; organizer_name: string; audience_size: number;
}

export default function AdminNewslettersPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>('pending');
  const [newsletters, setNewsletters]   = useState<NewsletterData[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<NewsletterData | null>(null);
  const [rejecting, setRejecting]       = useState(false);
  const [reason, setReason]             = useState('');
  const [acting, setActing]             = useState(false);
  const [result, setResult]             = useState<{ sent: number; failed: number } | null>(null);

  const load = () => {
    setLoading(true);
    const params = activeFilter !== 'all' ? `?status=${activeFilter}` : '';
    fetch(`/api/admin/newsletters${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setNewsletters(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [activeFilter]);

  const handleClose = () => {
    setSelected(null);
    setRejecting(false);
    setReason('');
    setResult(null);
  };

  const handleApprove = async (id: string) => {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/newsletters/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { setResult(data.data); load(); }
    } finally {
      setActing(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!reason.trim()) return;
    setActing(true);
    try {
      await fetch(`/api/admin/newsletters/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      handleClose();
      load();
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          Newsletter Queue
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Nothing reaches a buyer&apos;s inbox until it&apos;s approved here.
        </p>
      </div>

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

      {loading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}
      {!loading && newsletters.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nothing here.</p>
      )}

      {newsletters.length > 0 && (
        <div className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <Table>
            <Thead>
              <tr>
                <Th>Subject</Th><Th>Organiser</Th><Th>Audience</Th><Th>Submitted</Th><Th>Status</Th><Th>Action</Th>
              </tr>
            </Thead>
            <Tbody>
              {newsletters.map(n => (
                <Tr key={n.id}>
                  <Td><p className="font-medium max-w-[220px] truncate" style={{ color: 'var(--color-text)' }}>{n.subject}</p></Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{n.organizer_name}</span></Td>
                  <Td>
                    <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                      <Users size={12} />{n.audience_size}
                    </span>
                  </Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(n.submitted_at.split('T')[0])}</span></Td>
                  <Td>{statusBadge(n.status)}</Td>
                  <Td>
                    <Button size="sm" variant="outline" onClick={() => { setSelected(n); setRejecting(false); setReason(''); setResult(null); }}>
                      Review
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      <Drawer open={!!selected} onClose={handleClose} title={selected?.subject} width="560px">
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2 flex-wrap">
              {statusBadge(selected.status)}
              <Badge variant="gray">{selected.organizer_name}</Badge>
              <Badge variant="gray"><Users size={11} />{selected.audience_size} recipients</Badge>
            </div>

            {/* Full preview — what the recipient will actually see */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              <div className="p-4" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-dim)' }}>Subject</p>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{selected.subject}</p>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {selected.image_urls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className="w-full rounded-lg" />
                ))}
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>{selected.body}</p>
              </div>
            </div>

            {selected.status === 'rejected' && selected.rejection_reason && (
              <div className="rounded-lg border p-4 text-sm" style={{ backgroundColor: '#ef444408', borderColor: '#ef444435', color: 'var(--color-red)' }}>
                Rejected: {selected.rejection_reason}
              </div>
            )}

            {result && (
              <div className="rounded-lg border p-4 text-sm" style={{ backgroundColor: '#10b98110', borderColor: '#10b98130', color: '#10b981' }}>
                Sent to {result.sent} recipient{result.sent !== 1 ? 's' : ''}{result.failed > 0 ? `, ${result.failed} failed` : ''}.
              </div>
            )}

            {selected.status === 'pending' && !result && !rejecting && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="success" fullWidth disabled={acting} onClick={() => handleApprove(selected.id)}>
                  <CheckCircle size={15} />Approve &amp; Send
                </Button>
                <Button variant="danger" fullWidth disabled={acting} onClick={() => setRejecting(true)}>
                  <XCircle size={15} />Reject
                </Button>
              </div>
            )}

            {rejecting && (
              <div className="flex flex-col gap-3">
                <Textarea label="Rejection Reason" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Explain what needs to change…" rows={3} />
                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setRejecting(false)}>Cancel</Button>
                  <Button variant="danger" fullWidth disabled={!reason.trim() || acting} onClick={() => handleReject(selected.id)}>
                    Confirm Rejection
                  </Button>
                </div>
              </div>
            )}

            {(result || selected.status !== 'pending') && !rejecting && (
              <Button variant="outline" fullWidth onClick={handleClose}>Close</Button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
