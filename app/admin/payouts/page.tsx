'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatNGN, formatShortDate } from '@/lib/utils';

type Filter = 'all' | 'pending' | 'processing' | 'completed';

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending Confirmation' },
  { value: 'processing', label: 'Ready to Release' },
  { value: 'completed', label: 'Completed' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'completed': return <Badge variant="green">Completed</Badge>;
    case 'processing': return <Badge variant="amber">Processing</Badge>;
    case 'pending': return <Badge variant="gray">Pending</Badge>;
    default: return <Badge variant="gray">{status}</Badge>;
  }
};

interface PayoutData {
  id: string; event_name: string; organizer_name?: string; date: string;
  gross: number; fee: number; net: number; status: string;
}

interface PayoutSettings { percentage: number; }

export default function AdminPayoutsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [payouts, setPayouts] = useState<PayoutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [percentage, setPercentage] = useState(100);
  const [savingSettings, setSavingSettings] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const params = activeFilter !== 'all' ? `?status=${activeFilter}` : '';
    fetch(`/api/admin/payouts${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setPayouts(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [activeFilter]);

  useEffect(() => {
    fetch('/api/admin/payout-settings')
      .then(r => r.json())
      .then((d: { success: boolean; data: PayoutSettings }) => { if (d.success) setPercentage(d.data.percentage); })
      .catch(console.error);
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await fetch('/api/admin/payout-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentage }),
    });
    setSavingSettings(false);
  };

  const handleConfirmEvent = async (id: string) => {
    setActing(id);
    await fetch(`/api/admin/payouts/${id}/confirm-event`, { method: 'POST' });
    setActing(null);
    load();
  };

  const handleRelease = async (id: string) => {
    setActing(id);
    await fetch(`/api/admin/payouts/${id}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentage }),
    });
    setActing(null);
    load();
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        Payout Management
      </h1>

      <div className="rounded-xl border p-6"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Global Payout Percentage</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
          Control what percentage of escrow is released to organizers.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input type="range" min={0} max={100} value={percentage}
              onChange={(e) => setPercentage(Number(e.target.value))}
              className="w-full accent-[var(--color-purple)]" />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>
              <span>0%</span><span>100%</span>
            </div>
          </div>
          <div className="w-16 text-center text-xl font-bold rounded-lg py-1.5 flex-shrink-0"
            style={{ color: 'var(--color-purple-light)', backgroundColor: 'var(--color-purple-dim)' }}>
            {percentage}%
          </div>
        </div>
        <div className="mt-4">
          <Button disabled={savingSettings} onClick={handleSaveSettings}>
            {savingSettings ? 'Saving...' : 'Apply Setting'}
          </Button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
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
      {!loading && payouts.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No payouts found.</p>}

      {payouts.length > 0 && (
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <Table>
          <Thead>
            <tr>
              <Th>Event</Th><Th>Organizer</Th><Th>Date</Th><Th>Gross</Th><Th>Fee</Th><Th>Net</Th><Th>Status</Th><Th>Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {payouts.map((payout) => (
              <Tr key={payout.id}>
                <Td><p className="font-medium text-sm max-w-[160px] truncate" style={{ color: 'var(--color-text)' }}>{payout.event_name}</p></Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{payout.organizer_name ?? '—'}</span></Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(payout.date)}</span></Td>
                <Td><span style={{ color: 'var(--color-text)' }}>{formatNGN(payout.gross)}</span></Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatNGN(payout.fee)}</span></Td>
                <Td><span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatNGN(payout.net)}</span></Td>
                <Td>{statusBadge(payout.status)}</Td>
                <Td>
                  {payout.status === 'pending' && (
                    <Button size="sm" variant="outline" disabled={acting === payout.id}
                      style={{ borderColor: 'var(--color-amber)', color: 'var(--color-amber)' }}
                      onClick={() => handleConfirmEvent(payout.id)}>
                      <Clock size={13} />Confirm Event
                    </Button>
                  )}
                  {payout.status === 'processing' && (
                    <Button size="sm" variant="success" disabled={acting === payout.id} onClick={() => handleRelease(payout.id)}>
                      <CheckCircle size={13} />Release Payout
                    </Button>
                  )}
                  {payout.status === 'completed' && (
                    <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Paid</span>
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
