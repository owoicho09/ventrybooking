'use client';

import { useCallback, useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

interface Device { id: string; label: string | null; createdAt: string; lastUsedAt: string; current: boolean }
type Secure = (action: (headers: Record<string, string>) => Promise<Response>) => Promise<Response | null>;

const when = (iso: string) => new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Devices that can sign in without an emailed code (057). Removing one means
 * the next sign-in on it needs a code again.
 */
export function TrustedDevicesPanel({ secure }: { secure: Secure }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/organizer/devices').then(r => r.json()).then(d => setDevices(d.success ? d.data : [])).catch(() => setDevices([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (d: Device) => {
    setBusyId(d.id); setMsg(null);
    try {
      const res = await secure(h => fetch(`/api/organizer/devices/${d.id}`, { method: 'DELETE', headers: h }));
      if (!res) return;
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: body.error ?? 'Could not remove the device' }); return; }
      setDevices(ds => ds?.filter(x => x.id !== d.id) ?? ds);
      setMsg({ ok: true, text: d.current
        ? 'This device was removed. You stay signed in for now; next time you sign in here we’ll email you a code.'
        : `${d.label ?? 'Device'} removed. Signing in on it will need an emailed code.` });
    } finally { setBusyId(null); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Signed-in devices</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          These devices can sign in without a code. Any new device needs a code we email you. Remove anything you don&apos;t recognise, then change your password.
        </p>
      </div>
      {devices === null ? (
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Loading&hellip;</p>
      ) : devices.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>No trusted devices yet. The next time you sign in, confirm the emailed code to add this one.</p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
          {devices.map(d => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-start gap-2.5 min-w-0">
                <Monitor size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                    {d.label ?? 'Unknown device'}
                    {d.current && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-green)' }}>This device</span>}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Last used {when(d.lastUsedAt)} &middot; added {when(d.createdAt)}</p>
                </div>
              </div>
              <button type="button" onClick={() => remove(d)} disabled={busyId === d.id}
                className="text-xs font-medium rounded-md border px-2.5 py-1 disabled:opacity-50 flex-shrink-0"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-red)' }}>
                {busyId === d.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-xs" style={{ color: msg.ok ? 'var(--color-green)' : 'var(--color-red)' }}>{msg.text}</p>}
    </div>
  );
}
