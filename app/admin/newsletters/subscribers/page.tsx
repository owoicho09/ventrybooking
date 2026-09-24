'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type ListFilter = 'all' | 'ventry' | 'organizer';
type SourceFilter = 'all' | 'checkout' | 'notify_me';
type StatusFilter = 'active' | 'unsubscribed' | 'all';

interface Row {
  id: string; list: 'ventry' | 'organizer'; listName: string; name: string | null; eventName: string | null;
  source: 'checkout_consent' | 'checkout_consent_merged' | 'notify_me'; subscribedAt: string; unsubscribedAt: string | null;
}
interface Stats {
  ventryActive: number; ventryMerged: number; ventryNewLast7: number; ventryNewLast30: number; ventryUnsubscribed: number;
  organizerActive: number; organizerCheckout: number; organizerNotifyMe: number;
}

const sourceLabel = (s: Row['source']) =>
  s === 'notify_me' ? 'Notify Me' : s === 'checkout_consent_merged' ? 'Checkout (merged)' : 'Checkout consent';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            backgroundColor: value === o.value ? 'var(--color-purple)' : 'var(--color-surface)',
            color:           value === o.value ? '#fff' : 'var(--color-text-muted)',
            border:          `1px solid ${value === o.value ? 'var(--color-purple)' : 'var(--color-border)'}`,
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Everyone who has consented to marketing — names, not emails. */
export default function AdminSubscribersPage() {
  const [list, setList]     = useState<ListFilter>('ventry');
  const [source, setSource] = useState<SourceFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [q, setQ]           = useState('');
  const [query, setQuery]   = useState('');
  const [stats, setStats]   = useState<Stats | null>(null);
  const [total, setTotal]   = useState<number | null>(null);
  const [rows, setRows]     = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const fetchPage = useCallback(async (before: string | null) => {
    const params = new URLSearchParams({ list, source, status });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (query) params.set('q', query);
    if (before) params.set('before', before);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subscribers?${params}`, { cache: 'no-store' });
      const d = await res.json();
      if (!d.success) { setError(d.error ?? 'Failed to load'); return; }
      setError('');
      setStats(d.data.stats);
      setTotal(d.data.total);
      setCursor(d.data.nextCursor);
      setRows(prev => {
        if (!before) return d.data.rows;
        const seen = new Set(prev.map(r => r.id));
        return [...prev, ...(d.data.rows as Row[]).filter(r => !seen.has(r.id))];
      });
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [list, source, status, from, to, query]);

  // Short debounce so typing dates doesn't fire a request per keystroke; also
  // keeps the fetch's state updates out of the effect body itself.
  useEffect(() => {
    const t = setTimeout(() => { fetchPage(null); }, 250);
    return () => clearTimeout(t);
  }, [fetchPage]);

  const statCard = (label: string, value: number | undefined, hint?: string) => (
    <div className="rounded-xl border p-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        {value === undefined ? '—' : value.toLocaleString()}
      </p>
      {hint && <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>{hint}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/newsletters" className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Newsletter Queue
      </Link>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Subscribers</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Everyone who has consented to marketing, on Ventry&apos;s list and on organisers&apos; Audiences.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCard('Ventry list', stats?.ventryActive, stats ? `${stats.ventryMerged.toLocaleString()} merged from organiser consent` : undefined)}
        {statCard('New on Ventry list', stats?.ventryNewLast7, stats ? `last 7 days · ${stats.ventryNewLast30.toLocaleString()} in 30` : undefined)}
        {statCard('Organiser Audiences', stats?.organizerActive, stats ? `${stats.organizerCheckout.toLocaleString()} checkout · ${stats.organizerNotifyMe.toLocaleString()} Notify Me` : undefined)}
        {statCard('Left Ventry list', stats?.ventryUnsubscribed)}
      </div>

      <div className="rounded-xl border p-3 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <Chips value={list} onChange={setList} options={[
          { value: 'ventry', label: 'Ventry list' }, { value: 'organizer', label: 'Organiser Audiences' }, { value: 'all', label: 'Both' },
        ]} />
        <Chips value={source} onChange={setSource} options={[
          { value: 'all', label: 'Any source' }, { value: 'checkout', label: 'Checkout consent' }, { value: 'notify_me', label: 'Notify Me' },
        ]} />
        <Chips value={status} onChange={setStatus} options={[
          { value: 'active', label: 'Subscribed' }, { value: 'unsubscribed', label: 'Unsubscribed' }, { value: 'all', label: 'All' },
        ]} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs flex flex-col gap-1" style={{ color: 'var(--color-text-muted)' }}>From
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm"
              style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </label>
          <label className="text-xs flex flex-col gap-1" style={{ color: 'var(--color-text-muted)' }}>To
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm"
              style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </label>
        </div>
        <form onSubmit={e => { e.preventDefault(); setQuery(q.trim()); }} className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name" className="flex-1 min-w-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          <Button type="submit" size="sm" variant="outline">Search</Button>
        </form>
      </div>

      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {total === null ? '' : `${total.toLocaleString()} matching`}
        {list !== 'ventry' && total !== null ? ' (one row per organiser a person follows)' : ''}
      </p>

      {error && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}

      <ul className="rounded-xl border divide-y overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        {rows.length === 0 && !loading && (
          <li className="px-4 py-6 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>No one matches these filters.</li>
        )}
        {rows.map(r => (
          <li key={r.id} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{r.name || 'Unnamed'}</p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                {r.eventName ?? (r.source === 'notify_me' ? 'Organiser page' : 'Event unknown')}
                {list !== 'ventry' && <> · {r.listName}</>}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                {sourceLabel(r.source)} · {fmtDate(r.subscribedAt)}
                {r.unsubscribedAt && <> · left {fmtDate(r.unsubscribedAt)}</>}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <Badge variant={r.list === 'ventry' ? 'purple' : 'gray'}>{r.list === 'ventry' ? 'Ventry' : 'Organiser'}</Badge>
              {r.unsubscribedAt && <Badge variant="red">Unsubscribed</Badge>}
            </div>
          </li>
        ))}
      </ul>

      {cursor && (
        <Button variant="outline" disabled={loading} onClick={() => fetchPage(cursor)}>
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      )}
      {loading && rows.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}
    </div>
  );
}
