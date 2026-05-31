'use client';

import { useState, useEffect } from 'react';
import { Plus, ToggleLeft, ToggleRight, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatShortDate } from '@/lib/utils';

interface StaffId {
  id: string;
  code: string;
  label: string | null;
  active: boolean;
  expires_at: string;
  created_at: string;
  event: { id: string; event_name: string; date: string } | null;
}
interface EventOption { value: string; label: string; }

export default function StaffPage() {
  const [staffIds,      setStaffIds]      = useState<StaffId[]>([]);
  const [eventOptions,  setEventOptions]  = useState<EventOption[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [creating,      setCreating]      = useState(false);
  const [newEventId,    setNewEventId]    = useState('');
  const [newLabel,      setNewLabel]      = useState('');
  const [createError,   setCreateError]   = useState('');

  const load = async () => {
    const [staffRes, eventsRes] = await Promise.all([
      fetch('/api/organizer/staff').then(r => r.json()),
      fetch('/api/organizer/events').then(r => r.json()),
    ]);
    if (staffRes.success) {
      setStaffIds(staffRes.data.map((s: StaffId & { event: { id: string; event_name: string; date: string }[] | { id: string; event_name: string; date: string } | null }) => ({
        ...s,
        event: Array.isArray(s.event) ? s.event[0] ?? null : s.event,
      })));
    }
    if (eventsRes.success) {
      const opts = (eventsRes.data as { id: string; name: string; status: string }[])
        .filter(e => e.status === 'approved')
        .map(e => ({ value: e.id, label: e.name }));
      setEventOptions(opts);
      if (opts.length > 0 && !newEventId) setNewEventId(opts[0].value);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventId) { setCreateError('Select an event'); return; }
    setCreating(true); setCreateError('');
    const res  = await fetch('/api/organizer/staff', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ eventId: newEventId, label: newLabel }),
    });
    const data = await res.json();
    if (!data.success) { setCreateError(data.error ?? 'Failed to create'); setCreating(false); return; }
    setNewLabel('');
    await load();
    setCreating(false);
  };

  const toggleActive = async (code: string, active: boolean) => {
    await fetch(`/api/organizer/staff/${code}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active }),
    });
    setStaffIds(prev => prev.map(s => s.code === code ? { ...s, active } : s));
  };

  const isExpired = (expiresAt: string) => new Date() > new Date(expiresAt);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
            Staff IDs
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Create short access codes for door staff — no account required.
          </p>
        </div>
      </div>

      {/* Create new staff ID */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Create New Staff ID</h2>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <Select
              label="Event"
              options={eventOptions.length > 0 ? eventOptions : [{ value: '', label: 'No approved events' }]}
              value={newEventId}
              onChange={e => setNewEventId(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Label (optional)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="e.g. Main Door, VIP Entrance"
            />
          </div>
          <Button type="submit" disabled={creating || !newEventId}>
            <Plus size={16} />{creating ? 'Creating…' : 'Create'}
          </Button>
        </form>
        {createError && <p className="text-sm mt-2" style={{ color: 'var(--color-red)' }}>{createError}</p>}
        <p className="text-xs mt-4" style={{ color: 'var(--color-text-dim)' }}>
          Staff IDs expire automatically 24 hours after the event date. Staff enter the code once — their device remembers it for the duration of the event.
        </p>
      </div>

      {/* Staff ID list */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Active Staff IDs</h2>
        </div>

        {loading && <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}

        {!loading && staffIds.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
            <KeyRound size={32} style={{ color: 'var(--color-text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No staff IDs yet.</p>
            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              Create one above to let door staff validate tickets without your organizer login.
            </p>
          </div>
        )}

        {!loading && staffIds.length > 0 && (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {staffIds.map(s => {
              const expired = isExpired(s.expires_at);
              return (
                <div key={s.id} className="flex items-center gap-4 px-6 py-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-text)' }}>{s.code}</span>
                      {s.label && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</span>}
                      {expired
                        ? <Badge variant="gray">Expired</Badge>
                        : s.active
                        ? <Badge variant="green">Active</Badge>
                        : <Badge variant="red">Deactivated</Badge>
                      }
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                      {s.event?.event_name ?? '—'} · {s.event?.date ? formatShortDate(s.event.date) : '—'} · expires {formatShortDate(s.expires_at)}
                    </p>
                  </div>

                  {!expired && (
                    <button
                      onClick={() => toggleActive(s.code, !s.active)}
                      className="flex items-center gap-1.5 text-sm font-medium"
                      style={{ color: s.active ? 'var(--color-red)' : 'var(--color-green)' }}
                    >
                      {s.active
                        ? <><ToggleRight size={16} /> Deactivate</>
                        : <><ToggleLeft size={16} /> Reactivate</>
                      }
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4 text-sm" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>How it works</p>
        <ul className="flex flex-col gap-1" style={{ color: 'var(--color-text-muted)' }}>
          <li>• Give each door person their staff code. They don't need a Ventry account.</li>
          <li>• Staff open a scan URL on their phone. They enter the code once — the device remembers it.</li>
          <li>• Each subsequent QR scan shows the result (green/red) immediately with no friction.</li>
          <li>• Staff can only see scan results — no event details or sales figures.</li>
          <li>• Every scan is logged with the staff code so you can see who scanned which ticket.</li>
        </ul>
      </div>
    </div>
  );
}
