'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle, ExternalLink, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatNGN, formatShortDate } from '@/lib/utils';

type Filter = 'all' | 'pending' | 'processing' | 'otp_pending' | 'completed';

const filters: { value: Filter; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'pending',     label: 'Pending Confirmation' },
  { value: 'processing',  label: 'Ready to Release' },
  { value: 'otp_pending', label: 'OTP Pending' },
  { value: 'completed',   label: 'Completed' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'completed':   return <Badge variant="green">Completed</Badge>;
    case 'otp_pending': return <Badge variant="amber">OTP Pending</Badge>;
    case 'processing':  return <Badge variant="amber">Processing</Badge>;
    case 'pending':     return <Badge variant="gray">Pending</Badge>;
    default:            return <Badge variant="gray">{status}</Badge>;
  }
};

interface PayoutData {
  id: string; event_name: string; organizer_name?: string; date: string;
  gross: number; fee: number; net: number; status: string;
}

interface PayoutSettings { percentage: number; }

interface ReleaseResult {
  payoutId: string;
  eventName: string;
  status: 'otp_pending' | 'completed' | 'error';
  message: string;
}

export default function AdminPayoutsPage() {
  const [activeFilter, setActiveFilter]   = useState<Filter>('all');
  const [payouts, setPayouts]             = useState<PayoutData[]>([]);
  const [loading, setLoading]             = useState(true);
  const [percentage, setPercentage]       = useState(100);
  const [savingSettings, setSavingSettings] = useState(false);
  const [acting, setActing]               = useState<string | null>(null);
  const [releaseResult, setReleaseResult] = useState<ReleaseResult | null>(null);

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

  const handleRelease = async (payout: PayoutData) => {
    setActing(payout.id);
    try {
      const res  = await fetch(`/api/admin/payouts/${payout.id}/release`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ percentage }),
      });
      const data = await res.json();

      if (!res.ok) {
        setReleaseResult({
          payoutId:  payout.id,
          eventName: payout.event_name,
          status:    'error',
          message:   data.error ?? 'Failed to release payout',
        });
      } else if (data.data?.status === 'otp_pending') {
        setReleaseResult({
          payoutId:  payout.id,
          eventName: payout.event_name,
          status:    'otp_pending',
          message:   data.data.message ?? '',
        });
      } else {
        setReleaseResult({
          payoutId:  payout.id,
          eventName: payout.event_name,
          status:    'completed',
          message:   'Payout released successfully.',
        });
      }
    } catch {
      setReleaseResult({
        payoutId:  payout.id,
        eventName: payout.event_name,
        status:    'error',
        message:   'Network error — please try again.',
      });
    }
    setActing(null);
    load();
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        Payout Management
      </h1>

      {/* ── Global payout percentage ── */}
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

      {/* ── OTP pending banner ── */}
      {releaseResult?.status === 'otp_pending' && (
        <div className="rounded-xl border p-4 flex gap-3 items-start"
          style={{ backgroundColor: '#f59e0b12', borderColor: '#f59e0b50' }}>
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
              OTP Required — Action Needed in Paystack Dashboard
            </p>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              The transfer for <strong>{releaseResult.eventName}</strong> was initiated but Paystack requires
              OTP confirmation before funds are sent to the organizer&apos;s bank account.
            </p>
            <ol className="mt-2 text-sm flex flex-col gap-1 list-decimal list-inside" style={{ color: 'var(--color-text-muted)' }}>
              <li>Log in to your <a href="https://dashboard.paystack.com/" target="_blank" rel="noopener noreferrer"
                className="underline font-medium" style={{ color: 'var(--color-purple-light)' }}>Paystack Dashboard</a></li>
              <li>Navigate to <strong>Pay</strong> → <strong>Transfers</strong></li>
              <li>Find the pending transfer and enter the OTP sent to your registered number</li>
            </ol>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-dim)' }}>
              Once you approve the OTP, the payout status will update to <strong>Completed</strong> automatically via webhook.
              The payout row below now shows <strong>OTP Pending</strong>.
            </p>
          </div>
          <button onClick={() => setReleaseResult(null)} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Release success banner ── */}
      {releaseResult?.status === 'completed' && (
        <div className="rounded-xl border p-4 flex gap-3 items-start"
          style={{ backgroundColor: '#10b98112', borderColor: '#10b98140' }}>
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Payout Released</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Funds for <strong>{releaseResult.eventName}</strong> have been sent successfully.
            </p>
          </div>
          <button onClick={() => setReleaseResult(null)} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Error banner ── */}
      {releaseResult?.status === 'error' && (
        <div className="rounded-xl border p-4 flex gap-3 items-start"
          style={{ backgroundColor: '#ef444412', borderColor: '#ef444440' }}>
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>Release Failed</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{releaseResult.message}</p>
          </div>
          <button onClick={() => setReleaseResult(null)} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Filter tabs ── */}
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
      {!loading && payouts.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No payouts found.</p>
      )}

      {/* ── Payout table ── */}
      {payouts.length > 0 && (
        <div className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <Table>
            <Thead>
              <tr>
                <Th>Event</Th><Th>Organizer</Th><Th>Date</Th>
                <Th>Gross</Th><Th>Fee</Th><Th>Net</Th>
                <Th>Status</Th><Th>Action</Th>
              </tr>
            </Thead>
            <Tbody>
              {payouts.map((payout) => (
                <Tr key={payout.id}>
                  <Td>
                    <p className="font-medium text-sm max-w-[160px] truncate" style={{ color: 'var(--color-text)' }}>
                      {payout.event_name}
                    </p>
                  </Td>
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
                      <Button size="sm" variant="success" disabled={acting === payout.id}
                        onClick={() => handleRelease(payout)}>
                        <CheckCircle size={13} />Release Payout
                      </Button>
                    )}

                    {payout.status === 'otp_pending' && (
                      <a href="https://dashboard.paystack.com/" target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline"
                          style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                          <ExternalLink size={13} />Confirm OTP
                        </Button>
                      </a>
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

      {/* ── OTP guide (sticky info card when OTP-pending rows exist) ── */}
      {!loading && payouts.some(p => p.status === 'otp_pending') && !releaseResult && (
        <div className="rounded-xl border p-4 text-sm"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: '#f59e0b50' }}>
          <p className="font-semibold mb-1" style={{ color: '#f59e0b' }}>One or more transfers are awaiting OTP</p>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Log in to your{' '}
            <a href="https://dashboard.paystack.com/" target="_blank" rel="noopener noreferrer"
              className="underline" style={{ color: 'var(--color-purple-light)' }}>Paystack Dashboard</a>
            {' '}→ Pay → Transfers, and approve any pending transfers.
            Payout status updates to <strong>Completed</strong> automatically once Paystack confirms.
          </p>
        </div>
      )}
    </div>
  );
}
