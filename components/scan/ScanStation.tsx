'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { CameraScanner } from './CameraScanner';

type Outcome =
  | { kind: 'checking'; ticketId: string }
  | { kind: 'success'; name?: string; tier?: string; ticketId?: string }
  | { kind: 'already_used'; name?: string; tier?: string; firstScannedAt?: string | null }
  | { kind: 'invalid'; reason: string };

interface Props {
  /** Organiser path: the event being scanned (the API checks the ticket belongs to it). */
  eventId?: string;
  /** Staff path: sent alongside the ventry_staff cookie, so either authenticates. */
  staffCode?: string;
  /** After every completed check (e.g. to refresh a live log). */
  onScanned?: () => void;
}

/** How long a result stays up before the camera resumes on its own. */
const RESULT_MS: Record<Exclude<Outcome['kind'], 'checking'>, number> = {
  success: 1800,
  already_used: 3500,
  invalid: 3500,
};

function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

/**
 * Door station for the in-app camera: scans, validates through the same
 * /api/organizer/scan endpoint the phone-camera flow uses, and shows a
 * full-screen colour result that's readable at arm's length.
 */
export function ScanStation({ eventId, staffCode, onScanned }: Props) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [count, setCount] = useState(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = useRef(false);

  const dismiss = useCallback(() => {
    clearTimeout(dismissTimer.current);
    setOutcome(null);
  }, []);

  useEffect(() => () => clearTimeout(dismissTimer.current), []);

  const show = useCallback((o: Exclude<Outcome, { kind: 'checking' }>) => {
    setOutcome(o);
    clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setOutcome(null), RESULT_MS[o.kind]);
  }, []);

  const onDetect = useCallback(async (ticketId: string | null) => {
    if (busy.current) return;
    if (!ticketId) {
      buzz([80, 60, 80]);
      show({ kind: 'invalid', reason: 'That QR code isn’t a Ventry ticket.' });
      return;
    }
    busy.current = true;
    setOutcome({ kind: 'checking', ticketId });
    try {
      const res = await fetch('/api/organizer/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: ticketId, eventId, staffCode }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        buzz([80, 60, 80]);
        show({ kind: 'invalid', reason: 'You’re signed out. Reopen your staff link (or sign in) and try again.' });
      } else if (!res.ok || !data?.success) {
        buzz([80, 60, 80]);
        show({ kind: 'invalid', reason: data?.error ?? 'Couldn’t check this ticket. Try again.' });
      } else {
        const r = data.data as { result: 'success' | 'already_used' | 'invalid'; attendeeName?: string; ticketType?: string; reason?: string; firstScannedAt?: string | null; ticketId?: string };
        if (r.result === 'success') {
          buzz(120);
          setCount(c => c + 1);
          show({ kind: 'success', name: r.attendeeName, tier: r.ticketType, ticketId: r.ticketId ?? ticketId });
        } else if (r.result === 'already_used') {
          buzz([200, 80, 200]);
          show({ kind: 'already_used', name: r.attendeeName, tier: r.ticketType, firstScannedAt: r.firstScannedAt });
        } else {
          buzz([80, 60, 80]);
          show({ kind: 'invalid', reason: r.reason ?? 'Invalid ticket' });
        }
        onScanned?.();
      }
    } catch {
      buzz([80, 60, 80]);
      show({ kind: 'invalid', reason: 'No connection. Check your data or Wi-Fi and scan again.' });
    } finally {
      busy.current = false;
    }
  }, [eventId, staffCode, onScanned, show]);

  const tone =
    outcome?.kind === 'success' ? { bg: '#059669', Icon: CheckCircle2, title: 'Admitted' }
    : outcome?.kind === 'already_used' ? { bg: '#D97706', Icon: AlertTriangle, title: 'Already used' }
    : outcome?.kind === 'invalid' ? { bg: '#DC2626', Icon: XCircle, title: 'Not valid' }
    : null;

  return (
    <div className="w-full">
      <div className="relative">
        <CameraScanner onDetect={onDetect} paused={!!outcome} />

        {outcome?.kind === 'checking' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/70 text-white">
            <Loader2 size={34} className="animate-spin" />
            <p className="font-mono text-sm">{outcome.ticketId}</p>
          </div>
        )}

        {tone && outcome && outcome.kind !== 'checking' && (
          <button
            type="button"
            onClick={dismiss}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl p-6 text-center text-white"
            style={{ backgroundColor: tone.bg }}
            aria-live="assertive"
          >
            <tone.Icon size={64} strokeWidth={2.2} />
            <p className="text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>{tone.title}</p>
            {'name' in outcome && outcome.name && <p className="text-lg font-semibold">{outcome.name}</p>}
            {'tier' in outcome && outcome.tier && <p className="text-sm opacity-90">{outcome.tier}</p>}
            {outcome.kind === 'already_used' && outcome.firstScannedAt && (
              <p className="text-sm opacity-90">
                First scanned at {new Date(outcome.firstScannedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}
              </p>
            )}
            {outcome.kind === 'invalid' && <p className="max-w-xs text-sm opacity-95">{outcome.reason}</p>}
            <p className="mt-3 text-xs opacity-75">Tap to scan the next ticket</p>
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-xs" style={{ color: 'var(--color-text-dim)' }}>
        {count > 0 ? `${count} admitted on this device this session` : 'Hold the QR code inside the frame. Results show automatically.'}
      </p>
    </div>
  );
}
