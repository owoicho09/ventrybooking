'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Shuffle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatShortDate } from '@/lib/utils';

interface Candidate { id: string; name: string; slug: string; date: string; city: string; image: string; organizer: string }

/**
 * Admin > Homepage: choose and order the three events floating in the
 * homepage hero (063). Card 1 sits on top of the deck. Leave slots empty and
 * the homepage fills them automatically.
 */
export default function AdminHomepagePage() {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/homepage-hero', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (!d.success) { toast(d.error || 'Could not load', 'error'); return; }
        setCandidates(d.data.candidates);
        const ids = (d.data.slots as (string | null)[]).filter((x): x is string => !!x);
        setChosen(ids);
        setSaved(ids);
      })
      .catch(() => toast('Network error', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map(candidates.map(c => [c.id, c])), [candidates]);
  const dirty = chosen.join() !== saved.join();
  const others = candidates.filter(c => !chosen.includes(c.id));

  const move = (i: number, d: -1 | 1) => setChosen(list => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return list;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const shuffle = () => setChosen(list => {
    const next = [...list];
    for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
    return next;
  });

  const save = async (ids: string[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/homepage-hero', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds: ids }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) { toast(d.error || 'Could not save', 'error'); return; }
      setChosen(ids);
      setSaved(ids);
      toast(ids.length ? 'Homepage hero updated' : 'Hero is back to automatic', 'success');
    } catch {
      toast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const card = 'rounded-xl border p-5';
  const cardStyle = { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Homepage hero</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Choose the three events floating in the homepage hero and their order. Card 1 sits on top.
          Empty slots, or events that go off sale, are filled automatically.
        </p>
      </div>

      <div className={card} style={cardStyle}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>On the homepage ({chosen.length}/3)</h2>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" disabled={chosen.length < 2 || saving} onClick={shuffle}><Shuffle size={13} />Shuffle</Button>
            <Button size="sm" variant="outline" disabled={saving || (saved.length === 0 && chosen.length === 0)} onClick={() => save([])}>Use automatic</Button>
            <Button size="sm" disabled={!dirty || saving} onClick={() => save(chosen)}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : chosen.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nothing chosen: the homepage picks automatically (partners first, then the next events on sale). Add events below.
          </p>
        ) : (
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {chosen.map((id, i) => {
              const c = byId.get(id);
              return (
                <li key={id} className="rounded-lg border overflow-hidden flex flex-col" style={{ borderColor: i === 0 ? 'var(--color-purple)' : 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                  <div className="relative aspect-[4/5] bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c && <img src={c.image} alt="" className="w-full h-full object-cover" />}
                    <span className="absolute top-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: i === 0 ? 'var(--color-purple)' : 'rgba(0,0,0,.6)', color: '#fff' }}>
                      Card {i + 1}{i === 0 ? ' · on top' : ''}
                    </span>
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    <div>
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{c?.name ?? 'No longer on sale'}</p>
                      {c && <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{formatShortDate(c.date)} · {c.city}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" className="w-7 h-7 rounded-md flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
                        disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={13} /></button>
                      <button type="button" className="w-7 h-7 rounded-md flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
                        disabled={i === chosen.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={13} /></button>
                      <button type="button" className="w-7 h-7 rounded-md flex items-center justify-center ml-auto" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-red)' }}
                        onClick={() => setChosen(list => list.filter(x => x !== id))} aria-label="Remove from hero"><X size={13} /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {dirty && <p className="text-xs mt-3" style={{ color: 'var(--color-amber)' }}>Unsaved changes. Press Save to update the homepage.</p>}
      </div>

      <div className={card} style={cardStyle}>
        <h2 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Events on sale</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-dim)' }}>Only live events with a flyer or banner can go in the hero.</p>
        {!loading && others.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No other events to add.</p>}
        <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {others.map(c => (
            <li key={c.id} className="flex items-center gap-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt="" className="w-10 h-12 rounded object-cover flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{c.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-dim)' }}>{formatShortDate(c.date)} · {c.city}{c.organizer ? ` · ${c.organizer}` : ''}</p>
              </div>
              <a href={`/${c.slug}`} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }} aria-label={`Open ${c.name}`}><ExternalLink size={13} /></a>
              <Button size="sm" variant="outline" disabled={chosen.length >= 3} onClick={() => setChosen(list => [...list, c.id])}><Plus size={13} />Add</Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
