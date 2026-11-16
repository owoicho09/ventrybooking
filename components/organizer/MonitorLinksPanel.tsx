'use client';

import { useCallback, useEffect, useState } from 'react';
import { Info, Copy, Check, Plus, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Switch } from '@/components/organizer/TierGateFields';

interface MonitorLink {
  id: string; label: string | null; token: string; active: boolean;
  view_count: number; last_viewed_at: string | null; created_at: string;
}

const when = (iso: string) => new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Sponsor / partner monitor links for one event (056): a read-only live view
 * of sales, revenue (organiser's net), tiers, buyers and check-ins, shareable
 * without handing over the organiser login. Switch any link off at any time.
 */
export function MonitorLinksPanel({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [links, setLinks] = useState<MonitorLink[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const base = `/api/organizer/events/${eventId}/monitor-links`;

  const load = useCallback(() => {
    fetch(base).then(r => r.json()).then(d => setLinks(d.success ? d.data : [])).catch(() => setLinks([]));
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const urlFor = (l: MonitorLink) => `${window.location.origin}/monitor/${l.token}`;

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error || 'Could not create link', 'error'); return; }
      setLinks(ls => [d.data, ...(ls ?? [])]);
      setLabel('');
      copy(d.data);
    } finally { setBusy(false); }
  };

  const copy = async (l: MonitorLink) => {
    try {
      await navigator.clipboard.writeText(urlFor(l));
      setCopiedId(l.id);
      setTimeout(() => setCopiedId(c => (c === l.id ? null : c)), 2000);
      toast('Link copied. Send it to your sponsor.', 'success');
    } catch {
      toast('Copy failed. Open the link and copy it from the address bar.', 'error');
    }
  };

  const setActive = async (l: MonitorLink, active: boolean) => {
    setLinks(ls => ls?.map(x => (x.id === l.id ? { ...x, active } : x)) ?? ls);
    const res = await fetch(`${base}/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
    if (!res.ok) {
      setLinks(ls => ls?.map(x => (x.id === l.id ? { ...x, active: !active } : x)) ?? ls);
      toast('Could not update the link', 'error');
      return;
    }
    toast(active ? 'Link is on again' : 'Link switched off. It stops working within a minute.', 'success');
  };

  return (
    <div className="rounded-xl border p-5 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Sponsor monitor links</h2>
          <button type="button" onClick={() => setInfoOpen(o => !o)} aria-expanded={infoOpen} aria-label="What are monitor links?"
            className="inline-flex items-center justify-center w-5 h-5" style={{ color: infoOpen ? 'var(--color-purple-light)' : 'var(--color-text-dim)' }}>
            <Info size={14} />
          </button>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Let sponsors and partners watch this event&apos;s sales live, without your login.
        </p>
        {infoOpen && (
          <div className="text-xs leading-relaxed flex flex-col gap-1.5 rounded-md p-3 mt-2" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
            <p>Anyone with the link sees a read-only page that updates every minute: tickets sold, your net revenue (the figure on your dashboard), sales per ticket type, sales per day, number of buyers and check-ins.</p>
            <p>They can&apos;t change anything, and they never see buyers&apos; names, emails or phone numbers.</p>
            <p>Make one link per sponsor so you can see who&apos;s looking, and switch any link off the moment you want to stop sharing.</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input value={label} onChange={e => setLabel(e.target.value)} maxLength={80} placeholder="Who is it for? e.g. MTN sponsorship"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
          className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
        <button type="button" onClick={create} disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          style={{ backgroundColor: 'var(--color-purple)', color: '#fff' }}>
          <Plus size={14} />{busy ? 'Creating…' : 'Create link'}
        </button>
      </div>

      {links === null ? (
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Loading&hellip;</p>
      ) : links.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>No links yet.</p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
          {links.map(l => (
            <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: l.active ? 'var(--color-text)' : 'var(--color-text-dim)' }}>
                  {l.label || 'Untitled link'}{!l.active && ' · off'}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                  {l.view_count ? `Opened ${l.view_count} time${l.view_count === 1 ? '' : 's'}${l.last_viewed_at ? `, last ${when(l.last_viewed_at)}` : ''}` : 'Not opened yet'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {l.active && (
                  <>
                    <button type="button" onClick={() => copy(l)} aria-label={`Copy link for ${l.label || 'this sponsor'}`}
                      className="inline-flex items-center gap-1 text-xs rounded-md border px-2 py-1"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                      {copiedId === l.id ? <Check size={12} /> : <Copy size={12} />}{copiedId === l.id ? 'Copied' : 'Copy'}
                    </button>
                    <a href={`/monitor/${l.token}`} target="_blank" rel="noopener noreferrer" aria-label="Open the sponsor view"
                      className="inline-flex items-center rounded-md border p-1" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      <ExternalLink size={13} />
                    </a>
                  </>
                )}
                <Switch checked={l.active} onChange={v => setActive(l, v)} label={`${l.label || 'Link'} on or off`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
