'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { Textarea } from '@/components/ui/Input';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatShortDate } from '@/lib/utils';
import { CheckCircle, XCircle } from 'lucide-react';

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const kycBadge = (status: string) => {
  switch (status) {
    case 'approved': return <Badge variant="green">Approved</Badge>;
    case 'pending': return <Badge variant="amber">Pending</Badge>;
    case 'rejected': return <Badge variant="red">Rejected</Badge>;
    default: return <Badge variant="gray">{status}</Badge>;
  }
};

interface OrgData {
  id: string; name: string; email: string; kyc_status: string;
  kyc_submitted_at?: string; events_hosted?: number;
}

export default function AdminOrganizersPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [organizers, setOrganizers] = useState<OrgData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<OrgData | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const load = () => {
    setLoading(true);
    const params = activeFilter !== 'all' ? `?status=${activeFilter}` : '';
    fetch(`/api/admin/organizers${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setOrganizers(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [activeFilter]);

  const handleApprove = async (id: string) => {
    setActing(true);
    await fetch(`/api/admin/organizers/${id}/approve`, { method: 'POST' });
    setActing(false);
    setSelectedOrg(null);
    load();
  };

  const handleReject = async (id: string) => {
    if (!reason.trim()) return;
    setActing(true);
    await fetch(`/api/admin/organizers/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setActing(false);
    setSelectedOrg(null);
    setRejecting(false);
    setReason('');
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        KYC Review Queue
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
      {!loading && organizers.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No organizers found.</p>}

      {organizers.length > 0 && (
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <Table>
          <Thead>
            <tr>
              <Th>Organizer</Th><Th>Email</Th><Th>Submitted</Th><Th>Events</Th><Th>Status</Th><Th>Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {organizers.map((org) => (
              <Tr key={org.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: 'var(--color-purple)' }}>
                      {org.name[0]}
                    </div>
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>{org.name}</p>
                  </div>
                </Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{org.email}</span></Td>
                <Td>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {org.kyc_submitted_at ? formatShortDate(org.kyc_submitted_at) : '—'}
                  </span>
                </Td>
                <Td><span style={{ color: 'var(--color-text)' }}>{org.events_hosted ?? 0}</span></Td>
                <Td>{kycBadge(org.kyc_status)}</Td>
                <Td>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedOrg(org); setRejecting(false); setReason(''); }}>
                    Review
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
      )}

      <Drawer open={!!selectedOrg} onClose={() => setSelectedOrg(null)} title={`Review: ${selectedOrg?.name}`}>
        {selectedOrg && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 text-sm">
              {[
                ['Name', selectedOrg.name],
                ['Email', selectedOrg.email],
                ['KYC Status', selectedOrg.kyc_status],
                ['Submitted', selectedOrg.kyc_submitted_at ? formatShortDate(selectedOrg.kyc_submitted_at) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--color-text)' }}>{v}</span>
                </div>
              ))}
            </div>

            {!rejecting ? (
              <div className="flex gap-3">
                <Button variant="success" fullWidth disabled={acting} onClick={() => handleApprove(selectedOrg.id)}>
                  <CheckCircle size={15} />Approve
                </Button>
                <Button variant="danger" fullWidth onClick={() => setRejecting(true)}>
                  <XCircle size={15} />Reject
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Textarea label="Rejection Reason" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this KYC is being rejected..." rows={3} />
                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setRejecting(false)}>Cancel</Button>
                  <Button variant="danger" fullWidth disabled={!reason.trim() || acting} onClick={() => handleReject(selectedOrg.id)}>
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
