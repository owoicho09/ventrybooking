'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type Status = 'active' | 'unsubscribed' | 'all';

interface Subscriber {
  id: string; email: string; name: string | null; event_name: string | null;
  subscribed_at: string; unsubscribed_at: string | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

/** Everyone on Ventry's newsletter list, past and new. Separate from the Newsletter Queue. */
export default function AdminSubscribersPage() {
  const [all, setAll] = useState<Subscriber[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/admin/subscribers', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.success) setAll(d.data); else setError(d.error ?? 'Failed to load'); })
      .catch(() => setError('Network error'));
  }, []);

  const counts = useMemo(() => {
    const rows = all ?? [];
    const active = rows.filter(r => !r.unsubscribed_at).length;
    return { active, unsubscribed: rows.length - active, all: rows.length };
  }, [all]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (all ?? []).filter(r =>
      (status === 'all' || (status === 'active' ? !r.unsubscribed_at : !!r.unsubscribed_at)) &&
      (!q || r.email.toLowerCase().includes(q) || (r.name ?? '').toLowerCase().includes(q)),
    );
  }, [all, status, search]);

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(shown.map(r => r.email).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  const filters: { value: Status; label: string }[] = [
    { value: 'active', label: `Subscribed (${counts.active})` },
    { value: 'unsubscribed', label: `Unsubscribed (${counts.unsubscribed})` },
    { value: 'all', label: `All (${counts.all})` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          Subscribers
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Everyone subscribed to the Ventry newsletter.
        </p>
      </div>

      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Subscribers</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          {all ? counts.active.toLocaleString() : '—'}
        </p>
        {all && counts.unsubscribed > 0 && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-dim)' }}>{counts.unsubscribed} unsubscribed</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(({ value, label }) => (
            <button key={value} onClick={() => setStatus(value)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: status === value ? 'var(--color-purple)' : 'var(--color-surface)',
                color:           status === value ? '#fff' : 'var(--color-text-muted)',
                border:          `1px solid ${status === value ? 'var(--color-purple)' : 'var(--color-border)'}`,
              }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-dim)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email or name"
              className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          <Button variant="outline" onClick={copyEmails} disabled={shown.length === 0}>
            {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy emails'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
      {!all && !error && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}

      {all && (
        <ul className="rounded-xl border divide-y overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {shown.length === 0 && (
            <li className="px-4 py-6 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>No subscribers match.</li>
          )}
          {shown.map(r => (
            <li key={r.id} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{r.email}</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {r.name || 'No name'}{r.event_name && <> · via {r.event_name}</>}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{fmtDate(r.subscribed_at)}</p>
                {r.unsubscribed_at && <Badge variant="red">Unsubscribed {fmtDate(r.unsubscribed_at)}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
