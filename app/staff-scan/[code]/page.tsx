'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader2, ScanLine, Keyboard } from 'lucide-react';

type PageState = 'loading' | 'error' | 'ready';

interface StaffInfo {
  code:      string;
  label:     string | null;
  eventName: string;
  expiresAt: string;
}

// This page is the staff setup link — e.g. ventrybooking.com/staff-scan/STF-XXXX-XXXX
// Staff open it once in Safari before the event. It sets an HttpOnly cookie
// (ventry_staff) that SFSafariViewController — the mini-browser iOS Camera uses
// to open QR URLs — inherits from Safari's cookie jar. From that point on, every
// ticket the staff member scans with their camera auto-authenticates via the cookie
// with no prompts.
export default function StaffSetupPage() {
  const params = useParams();
  const router = useRouter();
  const code   = ((params?.code as string) ?? '').toUpperCase();

  const [state,      setState]      = useState<PageState>('loading');
  const [staffInfo,  setStaffInfo]  = useState<StaffInfo | null>(null);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [manualId,   setManualId]   = useState('');
  const [manualErr,  setManualErr]  = useState('');

  useEffect(() => {
    if (!code) {
      setErrorMsg('No staff code in URL.');
      setState('error');
      return;
    }

    // One call: validate the code AND set the HttpOnly cookie.
    fetch('/api/staff/session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          setErrorMsg(data.error ?? 'Invalid staff code');
          setState('error');
          return;
        }
        setStaffInfo({
          code:      data.code,
          label:     data.label ?? null,
          eventName: data.eventName,
          expiresAt: data.expiresAt,
        });
        setState('ready');
      })
      .catch(() => {
        setErrorMsg('Network error — check your connection and reload.');
        setState('error');
      });
  }, [code]);

  // manualId stores only the raw alphanumeric characters (max 8), no hyphens
  const manualDisplay = manualId.length === 0 ? '' :
    'TKT-' + manualId.slice(0, 4) + (manualId.length > 4 ? '-' + manualId.slice(4) : '');

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
      .replace(/^TKT[-\s]?/i, '')   // strip TKT prefix if the user pastes a full ID
      .replace(/[^A-Z0-9]/gi, '')   // strip hyphens and anything else
      .toUpperCase()
      .slice(0, 8);
    setManualId(raw);
    setManualErr('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.length !== 8) {
      setManualErr('Enter all 8 characters');
      return;
    }
    setManualErr('');
    router.push(`/scan/TKT-${manualId.slice(0, 4)}-${manualId.slice(4)}`);
  };

  if (state === 'loading') {
    return (
      <Screen>
        <Loader2 size={52} className="animate-spin mb-5" style={{ color: 'var(--color-purple)' }} />
        <Heading>Setting up…</Heading>
      </Screen>
    );
  }

  if (state === 'error') {
    return (
      <Screen>
        <AlertCircle size={56} style={{ color: 'var(--color-red)', marginBottom: '1.5rem' }} />
        <Heading>Setup failed</Heading>
        <Body>{errorMsg}</Body>
      </Screen>
    );
  }

  // Ready — cookie is set. Staff can now scan tickets with their camera.
  const expiryTime = staffInfo?.expiresAt
    ? new Date(staffInfo.expiresAt).toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <Screen>
      {/* Check mark */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
      >
        <CheckCircle size={44} style={{ color: '#22c55e' }} />
      </div>

      <Heading>You&rsquo;re all set</Heading>

      {/* Event + label */}
      <div className="mt-4 mb-8 text-center">
        <p className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          {staffInfo?.eventName}
        </p>
        {staffInfo?.label && (
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {staffInfo.label}
          </p>
        )}
        {expiryTime && (
          <p className="text-xs mt-2 font-mono" style={{ color: 'var(--color-text-dim)' }}>
            Session active until {expiryTime}
          </p>
        )}
      </div>

      {/* Instructions */}
      <div
        className="w-full max-w-xs rounded-2xl p-5 border text-left"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <ScanLine size={18} style={{ color: 'var(--color-purple)' }} />
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
            How to scan tickets
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {[
            'Open your iPhone Camera app',
            'Point it at the attendee\'s QR code',
            'Tap the notification banner that appears',
            'The result shows automatically — no prompts',
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
      </div>

      <p className="text-xs mt-6 max-w-xs text-center" style={{ color: 'var(--color-text-dim)' }}>
        Keep this tab open as a fallback. If you&rsquo;re ever prompted for a code again, reload this page.
      </p>

      {/* Manual ticket ID entry — camera fallback */}
      <div className="w-full max-w-xs mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-3 justify-center">
          <Keyboard size={15} style={{ color: 'var(--color-text-dim)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-dim)' }}>
            Camera not working? Type ticket ID
          </p>
        </div>
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
          <input
            value={manualDisplay}
            onChange={handleManualChange}
            placeholder="Type 8 chars — e.g. A3BKZ912"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            className="w-full px-4 py-3 rounded-xl text-center font-mono text-base font-bold tracking-widest border-2 focus:outline-none"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor:     manualErr ? 'var(--color-red)' : 'var(--color-border)',
              color:           'var(--color-text)',
            }}
          />
          {manualErr && (
            <p className="text-xs text-center" style={{ color: 'var(--color-red)' }}>{manualErr}</p>
          )}
          <button
            type="submit"
            disabled={manualId.length !== 8}
            className="w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}
          >
            {manualId.length > 0 && manualId.length < 8
              ? `${8 - manualId.length} more character${8 - manualId.length !== 1 ? 's' : ''}…`
              : 'Validate Ticket'}
          </button>
        </form>
      </div>

      <p className="text-xs mt-4 font-mono opacity-50" style={{ color: 'var(--color-text)' }}>
        {staffInfo?.code}
      </p>
    </Screen>
  );
}

/* ── Layout primitives ──────────────────────────────────────────── */

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8 py-12 text-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {children}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-3xl font-black tracking-tight"
      style={{ fontFamily: 'var(--font-syne), sans-serif', color: 'var(--color-text)' }}
    >
      {children}
    </p>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base mt-3 max-w-xs leading-relaxed text-center"
      style={{ color: 'var(--color-text-muted)' }}>
      {children}
    </p>
  );
}
