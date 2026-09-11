'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatShortDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface Commission {
  id: string;
  organizerName: string;
  eventName: string;
  grossAmount: number;
  commissionAmount: number;
  eventSequenceNumber: number;
  status: 'pending' | 'paid' | 'void';
  eventStatus: string | null;
  createdAt: string;
  paidAt: string | null;
  paidBy: string | null;
}

interface Detail {
  affiliate: { id: string; name: string; email: string; referralCode: string; createdAt: string };
  referralCount: number;
  commissions: Commission[];
}

const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

export default function AdminAffiliateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/affiliates/${id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (id) load(); }, [id]);

  const markPaid = async (commissionId: string) => {
    setActingId(commissionId);
    try {
      const res = await fetch(`/api/admin/affiliates/commissions/${commissionId}/mark-paid`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { toast(d.error ?? 'Failed to mark paid', 'error'); return; }
      load();
    } finally {
      setActingId(null);
    }
  };

  const markAllPaid = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch(`/api/admin/affiliates/${id}/mark-all-paid`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { toast(d.error ?? 'Failed to mark commissions paid', 'error'); return; }
      const { marked, skippedNotConfirmed } = d.data;
      toast(
        skippedNotConfirmed > 0
          ? `Marked ${marked} paid — ${skippedNotConfirmed} skipped (event not yet confirmed)`
          : `Marked ${marked} paid`,
        'success',
      );
      load();
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;
  if (!data) return null;

  const payable = data.commissions.filter(c => c.status === 'pending' && c.eventStatus === 'completed');
  const pendingCount = payable.length;
  const pendingTotal = payable.reduce((s, c) => s + c.commissionAmount, 0);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/affiliates" className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={14} />Back to Affiliates
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>{data.affiliate.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{data.affiliate.email} &middot; code <code>{data.affiliate.referralCode}</code> &middot; {data.referralCount} referral{data.referralCount !== 1 ? 's' : ''}</p>
        </div>
        {pendingCount > 0 && (
          <Button disabled={markingAll} onClick={markAllPaid}>
            {markingAll ? 'Marking…' : `Mark All ${pendingCount} Pending as Paid (${fmt(pendingTotal)})`}
          </Button>
        )}
      </div>

      {data.commissions.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No commissions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>Organiser</Th>
                <Th>Event</Th>
                <Th>#</Th>
                <Th>Gross</Th>
                <Th>Commission</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.commissions.map(c => (
                <Tr key={c.id}>
                  <Td>{c.organizerName}</Td>
                  <Td>{c.eventName}</Td>
                  <Td>{c.eventSequenceNumber}</Td>
                  <Td>{fmt(c.grossAmount)}</Td>
                  <Td>{fmt(c.commissionAmount)}</Td>
                  <Td>{formatShortDate(c.createdAt)}</Td>
                  <Td>
                    {c.status === 'paid' ? <Badge variant="green">Paid</Badge>
                      : c.status === 'void' ? <Badge variant="gray">Voided</Badge>
                      : c.eventStatus === 'completed' ? <Badge variant="amber">Pending</Badge>
                      : <Badge variant="gray">Awaiting event</Badge>}
                  </Td>
                  <Td>
                    {c.status === 'pending' && c.eventStatus === 'completed' ? (
                      <Button size="sm" variant="outline" disabled={actingId === c.id} onClick={() => markPaid(c.id)}>
                        {actingId === c.id ? 'Marking…' : 'Mark Paid'}
                      </Button>
                    ) : c.status === 'pending' ? (
                      <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Not confirmed yet</span>
                    ) : c.status === 'void' ? (
                      <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Event cancelled</span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{c.paidBy}</span>
                    )}
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
