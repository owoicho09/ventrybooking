'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, AlertCircle, Loader2, ScanLine } from 'lucide-react';

type PageState = 'loading' | 'unauthorized' | 'success' | 'already_used' | 'invalid' | 'ready';

interface ScanData {
  result:          'success' | 'already_used' | 'invalid';
  attendeeName?:   string;
  ticketType?:     string;
  eventName?:      string;
  reason?:         string;
  firstScannedAt?: string | null;
}

// Shows "Resetting in Ns..." and counts down to 0, then stops.
// Uses a setTimeout chain so no timer fires after the counter reaches zero.
function ResetIn({ total = 3 }: { total?: number }) {
  const [n, setN] = useState(total);
  useEffect(() => {
    if (n <= 0) return;
    const id = setTimeout(() => setN(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [n]);
  return (
    <p className="text-sm mt-6 opacity-50 text-white tracking-wide">
      Resetting in {n}s
    </p>
  );
}

export default function ScanValidatePage() {
  const params   = useParams();
  const ticketId = (params?.id as string) ?? '';

  const [state,      setState]      = useState<PageState>('loading');
  const [scanData,   setScanData]   = useState<ScanData | null>(null);

  useEffect(() => {
    if (!ticketId) return;

    let resetTimer: ReturnType<typeof setTimeout>;

    const validate = async () => {
      setState('loading');
      setScanData(null);

      try {
        const res = await fetch('/api/organizer/scan', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          // No eventId — server uses organizer-ownership check
          body: JSON.stringify({ qrToken: ticketId }),
        });

        if (res.status === 401) {
          setState('unauthorized');
          return;
        }

        const json = await res.json();

        if (!res.ok || !json.success) {
          setScanData({ result: 'invalid', reason: json.error ?? 'Validation service error' });
          setState('invalid');
          resetTimer = setTimeout(() => setState('ready'), 3000);
          return;
        }

        const data: ScanData = json.data;
        setScanData(data);
        setState(data.result);
        resetTimer = setTimeout(() => setState('ready'), 3000);
      } catch {
        setScanData({ result: 'invalid', reason: 'Network error — check your connection' });
        setState('invalid');
        resetTimer = setTimeout(() => setState('ready'), 3000);
      }
    };

    validate();
    return () => clearTimeout(resetTimer);
  }, [ticketId]);

  /* ── Loading ──────────────────────────────────────────────────── */
  if (state === 'loading') {
    return (
      <Screen bg="var(--color-bg)">
        <Loader2 size={64} className="animate-spin mb-6" style={{ color: 'var(--color-purple)' }} />
        <BigText style={{ color: 'var(--color-text)' }}>Validating…</BigText>
        <Mono>{ticketId}</Mono>
      </Screen>
    );
  }

  /* ── Unauthorized ─────────────────────────────────────────────── */
  if (state === 'unauthorized') {
    const loginHref = `/organizer/login?return=${encodeURIComponent(`/scan/${ticketId}`)}`;
    return (
      <Screen bg="#78350f">
        <AlertCircle size={88} strokeWidth={1.3} color="#fde68a" />
        <BigText color="#fff" mt>Staff Login Required</BigText>
        <Sub color="#fde68a">
          You need to be signed in as an event organizer to validate tickets.
        </Sub>
        <a
          href={loginHref}
          className="mt-8 px-10 py-3 rounded-2xl font-bold text-lg"
          style={{ backgroundColor: '#fde68a', color: '#78350f' }}
        >
          Log in as Organizer →
        </a>
        <Mono color="#fbbf24" style={{ marginTop: '2rem' }}>{ticketId}</Mono>
      </Screen>
    );
  }

  /* ── Ready ────────────────────────────────────────────────────── */
  if (state === 'ready') {
    return (
      <Screen bg="var(--color-bg)">
        <ScanLine size={72} strokeWidth={1.2} style={{ color: 'var(--color-purple)', marginBottom: '1.5rem' }} />
        <BigText style={{ color: 'var(--color-text)' }}>Ready</BigText>
        <Sub style={{ color: 'var(--color-text-muted)' }}>Point camera at next ticket</Sub>
      </Screen>
    );
  }

  /* ── Success ──────────────────────────────────────────────────── */
  if (state === 'success') {
    return (
      <Screen bg="#15803d">
        <CheckCircle size={100} strokeWidth={1.1} color="#fff" />
        <BigText color="#fff" mt>ACCESS GRANTED</BigText>
        {scanData?.attendeeName && (
          <p className="text-2xl font-semibold text-green-100 mt-2">{scanData.attendeeName}</p>
        )}
        {scanData?.ticketType && (
          <p className="text-base text-green-200 mt-1">{scanData.ticketType}</p>
        )}
        {scanData?.eventName && (
          <p className="text-sm text-green-300 mt-3 font-medium">{scanData.eventName}</p>
        )}
        <ResetIn />
      </Screen>
    );
  }

  /* ── Already used ─────────────────────────────────────────────── */
  if (state === 'already_used') {
    const when = scanData?.firstScannedAt
      ? new Date(scanData.firstScannedAt).toLocaleTimeString([], {
          hour:   '2-digit',
          minute: '2-digit',
        })
      : null;
    return (
      <Screen bg="#991b1b">
        <XCircle size={100} strokeWidth={1.1} color="#fff" />
        <BigText color="#fff" mt>ALREADY USED</BigText>
        {when && <Sub color="#fca5a5">First scanned at {when}</Sub>}
        {scanData?.attendeeName && (
          <p className="text-xl font-medium text-red-200 mt-2">{scanData.attendeeName}</p>
        )}
        <ResetIn />
      </Screen>
    );
  }

  /* ── Invalid ──────────────────────────────────────────────────── */
  return (
    <Screen bg="#991b1b">
      <AlertCircle size={100} strokeWidth={1.1} color="#fff" />
      <BigText color="#fff" mt>INVALID TICKET</BigText>
      {scanData?.reason && <Sub color="#fca5a5">{scanData.reason}</Sub>}
      <ResetIn />
    </Screen>
  );
}

/* ── Layout primitives ──────────────────────────────────────────── */

function Screen({
  bg,
  children,
}: {
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-8 text-center"
      style={{ backgroundColor: bg }}
    >
      {children}
    </div>
  );
}

function BigText({
  children,
  color,
  mt,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  mt?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <p
      className={`text-4xl sm:text-5xl font-black tracking-tight leading-none${mt ? ' mt-6' : ''}`}
      style={{ fontFamily: 'var(--font-syne), sans-serif', color, ...style }}
    >
      {children}
    </p>
  );
}

function Sub({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <p className="text-base mt-3 max-w-xs leading-relaxed" style={{ color, ...style }}>
      {children}
    </p>
  );
}

function Mono({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <p
      className="text-xs mt-4 opacity-60 font-mono"
      style={{ color: color ?? 'inherit', ...style }}
    >
      {children}
    </p>
  );
}
