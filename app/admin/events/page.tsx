'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Textarea } from '@/components/ui/Input';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatShortDate, formatNGN } from '@/lib/utils';

type Filter = 'all' | 'under_review' | 'approved' | 'rejected' | 'cancelled';

const filters: { value: Filter; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved',     label: 'Approved' },
  { value: 'rejected',     label: 'Rejected' },
  { value: 'cancelled',    label: 'Cancelled' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'approved':     return <Badge variant="green">Approved</Badge>;
    case 'under_review': return <Badge variant="amber">Under Review</Badge>;
    case 'rejected':     return <Badge variant="red">Rejected</Badge>;
    case 'completed':    return <Badge variant="blue">Completed</Badge>;
    case 'cancelled':    return <Badge variant="red">Cancelled</Badge>;
    default:             return <Badge variant="gray">{status}</Badge>;
  }
};

interface EventData {
  id: string; name: string; category: string; date: string; city: string; venue: string;
  description: string; status: string;
  organizer: { name: string; tier?: string };
}

interface CancelPreview {
  eventName: string;
  ticketCount: number;
  refundableCount: number;
  totalRefund: number;
}

interface CancelFailure { ticketId: string; email: string; reason: string; }
interface CancelResult  { refunded: number; failed: number; failures: CancelFailure[]; }

type CancelStep = 'loading' | 'confirm' | 'processing' | 'result' | null;

export default function AdminEventsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [events, setEvents]             = useState<EventData[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [rejecting, setRejecting]       = useState(false);
  const [reason, setReason]             = useState('');
  const [acting, setActing]             = useState(false);

  // Cancel-event flow state
  const [cancelStep,    setCancelStep]    = useState<CancelStep>(null);
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null>(null);
  const [cancelResult,  setCancelResult]  = useState<CancelResult | null>(null);

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

  const handleCloseDrawer = () => {
    setSelectedEvent(null);
    setRejecting(false);
    setReason('');
    setCancelStep(null);
    setCancelPreview(null);
    setCancelResult(null);
  };

  const handleApprove = async (id: string) => {
    setActing(true);
    await fetch(`/api/admin/events/${id}/approve`, { method: 'POST' });
    setActing(false);
    handleCloseDrawer();
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
    handleCloseDrawer();
    load();
  };

  const handleCancelPreview = async () => {
    if (!selectedEvent) return;
    setCancelStep('loading');
    try {
      const res  = await fetch(`/api/admin/events/${selectedEvent.id}/cancel`);
      const data = await res.json();
      if (data.success) {
        setCancelPreview(data.data);
        setCancelStep('confirm');
      } else {
        setCancelStep(null);
      }
    } catch {
      setCancelStep(null);
    }
  };

  const handleCancelConfirm = async () => {
    if (!selectedEvent) return;
    setCancelStep('processing');
    try {
      const res  = await fetch(`/api/admin/events/${selectedEvent.id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCancelResult(data.data);
        setCancelStep('result');
        load();
      } else {
        setCancelStep('confirm');
      }
    } catch {
      setCancelStep('confirm');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        Event Approval Queue
      </h1>

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
      {!loading && events.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No events found.</p>
      )}

      {events.length > 0 && (
        <div className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <Table>
            <Thead>
              <tr>
                <Th>Event Name</Th><Th>Organizer</Th><Th>Type</Th>
                <Th>Date</Th><Th>City</Th><Th>Status</Th><Th>Action</Th>
              </tr>
            </Thead>
            <Tbody>
              {events.map((event) => (
                <Tr key={event.id}>
                  <Td>
                    <p className="font-medium max-w-[200px] truncate" style={{ color: 'var(--color-text)' }}>
                      {event.name}
                    </p>
                  </Td>
                  <Td>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--color-text)' }}>{event.organizer.name}</p>
                      {event.organizer.tier && (
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{event.organizer.tier}</p>
                      )}
                    </div>
                  </Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{event.category}</span></Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(event.date)}</span></Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{event.city}</span></Td>
                  <Td>{statusBadge(event.status)}</Td>
                  <Td>
                    <Button size="sm" variant="outline"
                      onClick={() => { setSelectedEvent(event); setRejecting(false); setReason(''); setCancelStep(null); }}>
                      Review
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      <Drawer open={!!selectedEvent} onClose={handleCloseDrawer} title={selectedEvent?.name} width="520px">
        {selectedEvent && (
          <div className="flex flex-col gap-5">

            {/* Event detail fields */}
            <div className="flex flex-col gap-3 text-sm">
              {[
                ['Category', selectedEvent.category],
                ['Date',     formatShortDate(selectedEvent.date)],
                ['Venue',    selectedEvent.venue],
                ['City',     selectedEvent.city],
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

            {/* ── Cancel preview loading ── */}
            {cancelStep === 'loading' && (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Fetching ticket information…
              </p>
            )}

            {/* ── Cancel confirmation ── */}
            {cancelStep === 'confirm' && cancelPreview && (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border p-4"
                  style={{ backgroundColor: '#ef444408', borderColor: '#ef444435' }}>
                  <div className="flex gap-2 items-center mb-2">
                    <AlertTriangle size={15} style={{ color: '#ef4444' }} />
                    <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                      Confirm Event Cancellation
                    </p>
                  </div>
                  <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    This will permanently cancel{' '}
                    <strong style={{ color: 'var(--color-text)' }}>{selectedEvent.name}</strong>{' '}
                    and automatically refund all buyers with unused tickets.
                  </p>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-muted)' }}>Tickets to refund</span>
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {cancelPreview.ticketCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-muted)' }}>Total refund amount</span>
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {formatNGN(cancelPreview.totalRefund)}
                      </span>
                    </div>
                    {cancelPreview.ticketCount > cancelPreview.refundableCount && (
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--color-text-muted)' }}>Without payment ref (manual)</span>
                        <span style={{ color: '#f59e0b' }}>
                          {cancelPreview.ticketCount - cancelPreview.refundableCount}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs mt-3" style={{ color: 'var(--color-text-dim)' }}>
                    Service fee (₦100 per ticket) is non-refundable. Only the base ticket price is returned.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setCancelStep(null)}>Go Back</Button>
                  <Button variant="danger" fullWidth disabled={acting} onClick={handleCancelConfirm}>
                    Confirm Cancellation
                  </Button>
                </div>
              </div>
            )}

            {/* ── Processing ── */}
            {cancelStep === 'processing' && (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Processing refunds… this may take a moment.
              </p>
            )}

            {/* ── Results ── */}
            {cancelStep === 'result' && cancelResult && (
              <div className="flex flex-col gap-4">
                {cancelResult.failed === 0 ? (
                  <div className="rounded-lg border p-4"
                    style={{ backgroundColor: '#10b98110', borderColor: '#10b98130' }}>
                    <p className="text-sm font-semibold" style={{ color: '#10b981' }}>
                      All Refunds Processed Successfully
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {cancelResult.refunded} ticket{cancelResult.refunded !== 1 ? 's' : ''} refunded.
                      Buyers will receive their money within 3–10 business days.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg border p-4"
                      style={{ backgroundColor: '#f59e0b10', borderColor: '#f59e0b40' }}>
                      <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>Partial Success</p>
                      <div className="flex gap-4 mt-1.5 text-sm">
                        <span style={{ color: '#10b981' }}>{cancelResult.refunded} succeeded</span>
                        <span style={{ color: '#ef4444' }}>{cancelResult.failed} failed</span>
                      </div>
                    </div>
                    {cancelResult.failures.length > 0 && (
                      <div className="rounded-lg border overflow-hidden"
                        style={{ borderColor: 'var(--color-border)' }}>
                        <p className="px-4 py-2 text-xs font-semibold"
                          style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                          Failed Refunds — Resolve Manually via Paystack Dashboard
                        </p>
                        {cancelResult.failures.map((f, i) => (
                          <div key={i} className="px-4 py-2 border-t text-xs"
                            style={{ borderColor: 'var(--color-border)' }}>
                            <div style={{ color: 'var(--color-text)' }}>{f.ticketId}</div>
                            <div style={{ color: 'var(--color-text-muted)' }}>{f.email}</div>
                            <div className="mt-0.5" style={{ color: '#ef4444' }}>{f.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button variant="outline" fullWidth onClick={handleCloseDrawer}>Close</Button>
              </div>
            )}

            {/* ── Normal approve / reject / cancel actions ── */}
            {!rejecting && !cancelStep && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <Button variant="success" fullWidth disabled={acting} onClick={() => handleApprove(selectedEvent.id)}>
                    <CheckCircle size={15} />Approve
                  </Button>
                  <Button variant="danger" fullWidth onClick={() => setRejecting(true)}>
                    <XCircle size={15} />Reject
                  </Button>
                </div>

                {selectedEvent.status === 'approved' && (
                  <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <Button variant="danger" fullWidth onClick={handleCancelPreview}>
                      <XCircle size={15} />Cancel Event &amp; Refund All Buyers
                    </Button>
                    <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-text-dim)' }}>
                      Refunds base ticket price only. Service fees are non-refundable.
                    </p>
                  </div>
                )}
              </div>
            )}

            {rejecting && (
              <div className="flex flex-col gap-3">
                <Textarea label="Rejection Reason" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this event is being rejected…" rows={3} />
                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setRejecting(false)}>Cancel</Button>
                  <Button variant="danger" fullWidth disabled={!reason.trim() || acting}
                    onClick={() => handleReject(selectedEvent.id)}>
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
