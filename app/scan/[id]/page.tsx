'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, AlertCircle, Loader2, KeyRound } from 'lucide-react';

type PageState = 'loading' | 'staff_auth' | 'success' | 'already_used' | 'invalid' | 'ready';

interface ScanData {
  result:          'success' | 'already_used' | 'invalid';
  attendeeName?:   string;
  ticketType?:     string;
  eventName?:      string;
  reason?:         string;
  firstScannedAt?: string | null;
}

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
  const [codeInput,  setCodeInput]  = useState('');
  const [codeError,  setCodeError]  = useState('');
  const [codeLoading,setCodeLoading]= useState(false);

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Validate ticket ──────────────────────────────────────────────
  // No staffCode argument — auth is carried by the ventry_staff HttpOnly cookie
  // set when staff visited their setup link in Safari. SFSafariViewController
  // shares Safari's cookie jar, so the cookie travels with every request.
  const validate = async () => {
    setState('loading');
    setScanData(null);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    try {
      const res = await fetch('/api/organizer/scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ qrToken: ticketId }),
      });

      if (res.status === 401) {
        setState('staff_auth');
        return;
      }

      const json = await res.json();

      if (!res.ok || !json.success) {
        setScanData({ result: 'invalid', reason: json.error ?? 'Validation service error' });
        setState('invalid');
        resetTimerRef.current = setTimeout(() => setState('ready'), 3000);
        return;
      }

      const data: ScanData = json.data;
      setScanData(data);
      setState(data.result);
      resetTimerRef.current = setTimeout(() => setState('ready'), 3000);
    } catch {
      setScanData({ result: 'invalid', reason: 'Network error — check your connection' });
      setState('invalid');
      resetTimerRef.current = setTimeout(() => setState('ready'), 3000);
    }
  };

  useEffect(() => {
    if (!ticketId) return;
    validate();
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // ── Staff code submit ─────────────────────────────────────────────
  // Calls /api/staff/session which validates the code AND sets the HttpOnly
  // cookie. All subsequent Camera-opened scans will carry the cookie automatically.
  const handleStaffAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setCodeError('');
    setCodeLoading(true);

    try {
      const res  = await fetch('/api/staff/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCodeError(data.error ?? 'Invalid staff code');
        setCodeLoading(false);
        return;
      }

      setCodeLoading(false);
      await validate();
    } catch {
      setCodeError('Network error — please try again');
      setCodeLoading(false);
    }
  };

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

  /* ── Staff Auth ───────────────────────────────────────────────── */
  if (state === 'staff_auth') {
    return (
      <Screen bg="var(--color-bg)">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{ backgroundColor: 'var(--color-purple-dim)' }}
        >
          <KeyRound size={28} style={{ color: 'var(--color-purple-light)' }} />
        </div>
        <BigText style={{ color: 'var(--color-text)' }} mt={false}>Staff Access</BigText>
        <p className="text-base mt-3 mb-8 max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          Enter your staff code to validate tickets. For faster access, open your staff setup link in Safari first.
        </p>

        <form onSubmit={handleStaffAuth} className="w-full max-w-xs flex flex-col gap-3">
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            placeholder="STF-XXXX-XXXX"
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-center font-mono text-lg font-bold tracking-widest border-2 focus:outline-none"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor:     codeError ? 'var(--color-red)' : 'var(--color-border)',
              color:           'var(--color-text)',
            }}
          />
          {codeError && (
            <p className="text-sm text-center" style={{ color: 'var(--color-red)' }}>{codeError}</p>
          )}
          <button
            type="submit"
            disabled={codeLoading || !codeInput}
            className="w-full py-3 rounded-xl font-bold text-base disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-purple)', color: '#fff' }}
          >
            {codeLoading ? 'Verifying…' : 'Continue'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t w-full max-w-xs text-center"
          style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>Are you the organizer?</p>
          <a
            href={`/organizer/login?return=${encodeURIComponent(`/scan/${ticketId}`)}`}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--color-purple-light)' }}
          >
            Sign in as Organizer →
          </a>
        </div>

        <Mono style={{ marginTop: '1rem' }}>{ticketId}</Mono>
      </Screen>
    );
  }

  /* ── Ready ────────────────────────────────────────────────────── */
  if (state === 'ready') {
    return (
      <Screen bg="var(--color-bg)">
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
      ? new Date(scanData.firstScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

function Screen({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-8 text-center"
      style={{ backgroundColor: bg }}>
      {children}
    </div>
  );
}

function BigText({ children, color, mt, style }: {
  children: React.ReactNode; color?: string; mt?: boolean; style?: React.CSSProperties;
}) {
  return (
    <p className={`text-4xl sm:text-5xl font-black tracking-tight leading-none${mt ? ' mt-6' : ''}`}
      style={{ fontFamily: 'var(--font-syne), sans-serif', color, ...style }}>
      {children}
    </p>
  );
}

function Sub({ children, color, style }: {
  children: React.ReactNode; color?: string; style?: React.CSSProperties;
}) {
  return (
    <p className="text-base mt-3 max-w-xs leading-relaxed" style={{ color, ...style }}>
      {children}
    </p>
  );
}

function Mono({ children, color, style }: {
  children: React.ReactNode; color?: string; style?: React.CSSProperties;
}) {
  return (
    <p className="text-xs mt-4 opacity-60 font-mono" style={{ color: color ?? 'inherit', ...style }}>
      {children}
    </p>
  );
}
