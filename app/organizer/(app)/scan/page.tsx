'use client';

import { useState, useEffect } from 'react';
import { ScanLine, Smartphone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface ScanLog {
  id: string;
  ticket_id: string;
  attendee_name: string;
  ticket_type: string;
  scanned_at: string;
  result: string;
}
interface EventOption { value: string; label: string; }
type ManualResult = {
  type: 'success' | 'already_used' | 'invalid';
  name?: string;
  ticketType?: string;
  reason?: string;
};

export default function ScanPage() {
  const [manualId, setManualId]       = useState('');
  const [manualResult, setManualResult] = useState<ManualResult | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [scanLogs, setScanLogs]       = useState<ScanLog[]>([]);
  const [stats, setStats]             = useState({ scanned: 0, rejected: 0, remaining: 0 });
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');

  useEffect(() => {
    fetch('/api/organizer/events')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const opts = (d.data as { status: string; id: string; name: string }[])
            .filter(e => e.status === 'approved')
            .map(e => ({ value: e.id, label: e.name }));
          setEventOptions(opts);
          if (opts.length > 0) setSelectedEvent(opts[0].value);
        }
      })
      .catch(console.error);
  }, []);

  const refreshLogs = (eventId: string) => {
    fetch(`/api/organizer/scan/logs?eventId=${eventId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setScanLogs(d.data.logs);
          setStats({
            scanned:   d.data.stats.scanned,
            rejected:  d.data.stats.rejected,
            remaining: d.data.stats.remaining ?? 0,
          });
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (!selectedEvent) return;
    refreshLogs(selectedEvent);
  }, [selectedEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualValidate = async () => {
    const id = manualId.trim();
    if (!id || !selectedEvent || submitting) return;
    setSubmitting(true);
    setManualResult(null);
    try {
      const res  = await fetch('/api/organizer/scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ qrToken: id, eventId: selectedEvent }),
      });
      const data = await res.json();

      if (!res.ok) {
        const reason = res.status === 401
          ? 'Session expired — please log in again'
          : (data?.error ?? 'Server error — please try again');
        setManualResult({ type: 'invalid', reason });
      } else if (data.success) {
        const r = data.data;
        setManualResult({
          type:       r.result,
          name:       r.attendeeName,
          ticketType: r.ticketType,
          reason:     r.reason,
        });
        setManualId('');
        // Refresh log once after a scan result
        refreshLogs(selectedEvent);
      } else {
        setManualResult({ type: 'invalid', reason: data.error ?? 'Validation failed' });
      }
      setTimeout(() => setManualResult(null), 5000);
    } catch (err) {
      console.error(err);
      setManualResult({ type: 'invalid', reason: 'Network error — check your connection' });
      setTimeout(() => setManualResult(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-0 -m-4 lg:-m-8" style={{ height: 'calc(100svh - 4rem)' }}>

      {/* ── Header ── */}
      <div
        className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <ScanLine size={20} style={{ color: 'var(--color-purple)' }} />
        <h1
          className="font-bold text-lg"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
        >
          Scan Tickets
        </h1>
        <div className="ml-auto w-full sm:w-64">
          <Select
            options={eventOptions.length > 0 ? eventOptions : [{ value: '', label: 'No approved events' }]}
            label=""
            value={selectedEvent}
            onChange={e => setSelectedEvent(e.target.value)}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* ── Left: instructions + manual fallback ── */}
        <div
          className="flex-1 flex flex-col items-center justify-center gap-6 p-6"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          {/* Camera instructions card */}
          <div
            className="w-full max-w-sm rounded-2xl p-6 border"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--color-purple-dim)' }}
              >
                <Smartphone size={20} style={{ color: 'var(--color-purple-light)' }} />
              </div>
              <h2
                className="font-bold text-base"
                style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
              >
                Use Your Phone Camera
              </h2>
            </div>

            <ol className="flex flex-col gap-3">
              {[
                'Open your phone\'s native camera app',
                'Point it at the attendee\'s QR code',
                'Tap the banner notification that appears',
                'The result opens full screen automatically',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}
                  >
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <p
              className="text-xs mt-5 pt-4 border-t"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
            >
              Make sure your browser is signed in as an organizer before scanning begins.
            </p>
          </div>

          {/* Manual result card */}
          {manualResult && (
            <div
              className="w-full max-w-sm rounded-xl p-4 flex items-start gap-3 border"
              style={{
                backgroundColor: manualResult.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                borderColor:     manualResult.type === 'success' ? 'var(--color-green)' : 'var(--color-red)',
              }}
            >
              {manualResult.type === 'success'
                ? <CheckCircle size={18} style={{ color: 'var(--color-green)', flexShrink: 0, marginTop: 1 }} />
                : manualResult.type === 'already_used'
                ? <XCircle    size={18} style={{ color: 'var(--color-red)',   flexShrink: 0, marginTop: 1 }} />
                : <AlertCircle size={18} style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: 1 }} />
              }
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: manualResult.type === 'success' ? 'var(--color-green)' : 'var(--color-red)' }}
                >
                  {manualResult.type === 'success'
                    ? 'Access Granted'
                    : manualResult.type === 'already_used'
                    ? 'Already Used'
                    : 'Invalid Ticket'}
                </p>
                {manualResult.name && (
                  <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-text)' }}>
                    {manualResult.name}
                    {manualResult.ticketType ? ` · ${manualResult.ticketType}` : ''}
                  </p>
                )}
                {manualResult.reason && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {manualResult.reason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Manual fallback input */}
          <div className="w-full max-w-sm">
            <p
              className="text-[10px] uppercase tracking-widest font-semibold mb-2"
              style={{ color: 'var(--color-text-dim)' }}
            >
              Manual fallback
            </p>
            <div className="flex gap-2">
              <Input
                label=""
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualValidate()}
                placeholder="Ticket ID — e.g. TKT-XXXX-XXXX"
                className="font-mono text-xs"
              />
              <div className="flex-shrink-0">
                <Button
                  onClick={handleManualValidate}
                  disabled={!manualId || !selectedEvent || submitting}
                >
                  {submitting ? '…' : 'Validate'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: stats + live log ── */}
        <div
          className="w-full lg:w-80 flex flex-col border-t lg:border-t-0 lg:border-l flex-shrink-0 overflow-hidden"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          {/* Stats row */}
          <div className="grid grid-cols-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            {[
              { label: 'Scanned In', value: stats.scanned,   color: 'var(--color-green)' },
              { label: 'Rejected',   value: stats.rejected,  color: 'var(--color-red)' },
              { label: 'Remaining',  value: stats.remaining, color: 'var(--color-text-muted)' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="p-4 text-center border-r last:border-0"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                <p
                  className="text-[10px] uppercase tracking-wider mt-0.5"
                  style={{ color: 'var(--color-text-dim)' }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Live scan log */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            <p
              className="text-xs uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-dim)' }}
            >
              Recent Scans
            </p>
            {scanLogs.length === 0 && (
              <p className="text-xs text-center mt-8" style={{ color: 'var(--color-text-dim)' }}>
                No scans yet for this event
              </p>
            )}
            {scanLogs.map(log => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-lg p-3"
                style={{ backgroundColor: 'var(--color-surface-2)' }}
              >
                {log.result === 'success'
                  ? <CheckCircle size={15} style={{ color: 'var(--color-green)', flexShrink: 0 }} />
                  : <XCircle    size={15} style={{ color: 'var(--color-red)',   flexShrink: 0 }} />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                    {log.attendee_name}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                    {log.ticket_type} &middot; {log.ticket_id}
                  </p>
                </div>
                <span
                  className="text-[10px] flex-shrink-0 font-semibold"
                  style={{ color: log.result === 'success' ? 'var(--color-green)' : 'var(--color-red)' }}
                >
                  {log.result === 'success' ? 'OK' : log.result === 'already_used' ? 'USED' : 'INVALID'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
