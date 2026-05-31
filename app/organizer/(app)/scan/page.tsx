'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ScanLine, CheckCircle, XCircle, Camera, CameraOff } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ScanResult } from '@/components/tickets/ScanResult';

// BarcodeDetector is available on Chrome 88+ / Android without any npm package.
// Declared here so TypeScript doesn't complain on environments where it exists.
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => {
      detect(src: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
    };
  }
}

interface ScanLog { id: string; ticket_id: string; attendee_name: string; ticket_type: string; scanned_at: string; result: string; }
interface EventOption { value: string; label: string; }
type ScanResultType = 'success' | 'already_used' | 'invalid';

export default function ScanPage() {
  const [manualId, setManualId]       = useState('');
  const [result, setResult]           = useState<ScanResultType | null>(null);
  const [attendeeName, setAttendeeName] = useState('');
  const [ticketType, setTicketType]   = useState('');
  const [scanning, setScanning]       = useState(false);
  const [scanLogs, setScanLogs]       = useState<ScanLog[]>([]);
  const [stats, setStats]             = useState({ scanned: 0, rejected: 0, remaining: 0 });
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState('');
  const [hasCamera, setHasCamera]     = useState(false);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const animRef     = useRef<number>(0);
  const scanningRef = useRef(false); // sync ref so the scan loop can read current state

  // Check for camera support on mount
  useEffect(() => {
    setHasCamera(!!(navigator.mediaDevices?.getUserMedia));
  }, []);

  // Load organiser's approved events
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

  // Reload scan logs whenever selectedEvent or result changes
  useEffect(() => {
    if (!selectedEvent) return;
    fetch(`/api/organizer/scan/logs?eventId=${selectedEvent}`)
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
  }, [selectedEvent, result]);

  // Stop camera when component unmounts or event changes
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const handleScan = useCallback(async (token: string) => {
    if (scanningRef.current || !token || !selectedEvent) return;
    scanningRef.current = true;
    setScanning(true);
    try {
      const res = await fetch('/api/organizer/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: token.trim(), eventId: selectedEvent }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data.result);
        setAttendeeName(data.data.attendeeName || '');
        setTicketType(data.data.ticketType || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
      scanningRef.current = false;
    }
  }, [selectedEvent]);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      if (window.BarcodeDetector) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const loop = async () => {
          if (!videoRef.current || !streamRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) await handleScan(codes[0].rawValue);
          } catch { /* frame not ready */ }
          animRef.current = requestAnimationFrame(loop);
        };
        animRef.current = requestAnimationFrame(loop);
      } else {
        // BarcodeDetector unavailable (iOS / older browser) — camera shown, manual input used
        setCameraError('Auto-scan not supported on this browser. Point camera and paste the QR token below.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(msg.includes('Permission') || msg.includes('NotAllowed')
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : 'Could not open camera. Use manual input below.');
      setCameraActive(false);
    }
  }, [handleScan]);

  const handleValidateManual = () => handleScan(manualId);

  const handleDismiss = () => {
    setResult(null);
    setManualId('');
    scanningRef.current = false;
  };

  return (
    <div className="flex flex-col gap-0 -m-8" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <ScanLine size={20} style={{ color: 'var(--color-purple)' }} />
        <h1 className="font-bold text-lg" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
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

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* Left — camera + input */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6"
          style={{ backgroundColor: 'var(--color-bg)' }}>

          {/* Camera viewport */}
          <div className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden flex-shrink-0"
            style={{ backgroundColor: '#000', maxHeight: '280px' }}>

            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: cameraActive ? 'block' : 'none' }}
            />

            {/* Scan line animation */}
            {cameraActive && (
              <div className="absolute left-0 right-0 h-0.5 animate-scan"
                style={{ backgroundColor: 'var(--color-purple)', boxShadow: '0 0 8px var(--color-purple)' }} />
            )}

            {/* Corner brackets */}
            {(['top-2 left-2 border-t-2 border-l-2','top-2 right-2 border-t-2 border-r-2',
               'bottom-2 left-2 border-b-2 border-l-2','bottom-2 right-2 border-b-2 border-r-2'] as const)
              .map((cls, i) => (
              <div key={i} className={`absolute w-6 h-6 rounded-sm ${cls}`}
                style={{ borderColor: 'var(--color-purple)' }} />
            ))}

            {/* Scan result overlay */}
            {result && (
              <ScanResult result={result} attendeeName={attendeeName} ticketType={ticketType} onDismiss={handleDismiss} />
            )}

            {/* Placeholder when camera is off */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <CameraOff size={32} style={{ color: 'rgba(255,255,255,0.3)' }} />
                <p className="text-xs text-center px-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {cameraError || 'Camera not started'}
                </p>
              </div>
            )}
          </div>

          {/* Camera error message */}
          {cameraError && cameraActive && (
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--color-amber)' }}>
              {cameraError}
            </p>
          )}

          {/* Camera toggle button */}
          {hasCamera && (
            <Button
              variant={cameraActive ? 'outline' : 'default'}
              onClick={cameraActive ? stopCamera : startCamera}
            >
              <Camera size={15} />
              {cameraActive ? 'Stop Camera' : 'Start Camera'}
            </Button>
          )}

          {!hasCamera && (
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
              Camera not available. Use the manual input below.
            </p>
          )}

          {/* Manual input */}
          <div className="flex gap-2 w-full max-w-xs">
            <Input
              label=""
              value={manualId}
              onChange={e => setManualId(e.target.value.trim())}
              placeholder="Paste QR token or Ticket ID"
              className="font-mono text-xs"
            />
            <div className="flex-shrink-0">
              <Button
                onClick={handleValidateManual}
                disabled={!manualId || !selectedEvent || scanning}
              >
                {scanning ? '…' : 'Validate'}
              </Button>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
            Tap Validate after pasting the full QR token from the ticket
          </p>
        </div>

        {/* Right — stats + logs */}
        <div className="w-full lg:w-80 flex flex-col border-t lg:border-t-0 lg:border-l flex-shrink-0 overflow-hidden"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>

          {/* Stats row */}
          <div className="grid grid-cols-3 border-b flex-shrink-0"
            style={{ borderColor: 'var(--color-border)' }}>
            {[
              { label: 'Scanned In', value: stats.scanned,   color: 'var(--color-green)' },
              { label: 'Rejected',   value: stats.rejected,  color: 'var(--color-red)' },
              { label: 'Remaining',  value: stats.remaining, color: 'var(--color-text-muted)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 text-center border-r last:border-0"
                style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Scan log */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-dim)' }}>
              Recent Scans
            </p>
            {scanLogs.length === 0 && (
              <p className="text-xs text-center mt-8" style={{ color: 'var(--color-text-dim)' }}>
                No scans yet for this event
              </p>
            )}
            {scanLogs.map(log => (
              <div key={log.id} className="flex items-center gap-3 rounded-lg p-3"
                style={{ backgroundColor: 'var(--color-surface-2)' }}>
                {log.result === 'success'
                  ? <CheckCircle size={15} style={{ color: 'var(--color-green)', flexShrink: 0 }} />
                  : <XCircle    size={15} style={{ color: 'var(--color-red)',   flexShrink: 0 }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                    {log.attendee_name}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                    {log.ticket_type} &middot; {log.ticket_id}
                  </p>
                </div>
                <span className="text-[10px] flex-shrink-0 font-semibold"
                  style={{ color: log.result === 'success' ? 'var(--color-green)' : 'var(--color-red)' }}>
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
