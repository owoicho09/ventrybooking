'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fmtDay } from '@/components/admin/settlementUi';

interface Holiday { holiday_date: string; name: string; created_by: string | null }

/** Nigerian public holidays used by settlement working-day rules. */
export default function SettlementHolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  // Lagos date (UTC+1), fixed at mount.
  const [today] = useState(() => new Date(Date.now() + 3600_000).toISOString().slice(0, 10));

  const load = useCallback(() => {
    fetch('/api/admin/settlement-holidays', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.success) setHolidays(d.data); })
      .catch(console.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const res = await fetch('/api/admin/settlement-holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, name }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { setDate(''); setName(''); setMsg('Saved.'); load(); }
    else setMsg(d.error ?? 'Failed to save');
  };

  const remove = async (d: string) => {
    if (confirmDelete !== d) { setConfirmDelete(d); return; }
    setConfirmDelete(null);
    await fetch(`/api/admin/settlement-holidays?date=${d}`, { method: 'DELETE' });
    load();
  };

  const upcoming = holidays.filter(h => h.holiday_date >= today);
  const past = holidays.filter(h => h.holiday_date < today).reverse();

  const row = (h: Holiday) => (
    <li key={h.holiday_date} className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{fmtDay(h.holiday_date)} {h.holiday_date.slice(0, 4)}</p>
        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{h.name}</p>
      </div>
      <button onClick={() => remove(h.holiday_date)} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg flex-shrink-0"
        style={{ color: 'var(--color-red)', border: '1px solid var(--color-border)' }}>
        <Trash2 size={13} />{confirmDelete === h.holiday_date ? 'Tap to confirm' : 'Remove'}
      </button>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/payouts" className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Payouts
      </Link>
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Holiday calendar</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Sales roll past weekends and these days to the next working day. Islamic holidays marked “(est.)” should be corrected once the Federal Government declares them.
        </p>
      </div>

      <form onSubmit={add} className="rounded-xl border p-4 flex flex-col gap-3"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Eid-el-Kabir" required />
        {msg && <p className="text-xs" style={{ color: msg === 'Saved.' ? 'var(--color-green)' : 'var(--color-red)' }}>{msg}</p>}
        <Button type="submit" disabled={saving} fullWidth>{saving ? 'Saving…' : 'Add holiday'}</Button>
      </form>

      <section className="rounded-xl border px-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-sm font-semibold pt-3" style={{ color: 'var(--color-text)' }}>Upcoming</h2>
        {upcoming.length === 0 && <p className="text-sm py-3" style={{ color: 'var(--color-text-muted)' }}>None — add the coming year&apos;s holidays.</p>}
        <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>{upcoming.map(row)}</ul>
      </section>

      {past.length > 0 && (
        <section className="rounded-xl border px-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <button className="text-sm font-semibold py-3 w-full text-left" style={{ color: 'var(--color-text)' }} onClick={() => setShowPast(v => !v)}>
            Past ({past.length}) {showPast ? '▾' : '▸'}
          </button>
          {showPast && <ul className="divide-y pb-1" style={{ borderColor: 'var(--color-border)' }}>{past.map(row)}</ul>}
        </section>
      )}
    </div>
  );
}
