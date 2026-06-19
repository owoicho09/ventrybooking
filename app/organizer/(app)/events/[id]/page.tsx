'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Download, Upload, Plus, Pencil, Check, X,
  AlertTriangle, Ticket,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { formatNGN, formatShortDate } from '@/lib/utils';

interface Tier { id: string; name: string; price: number; available: number; sold: number; }
interface OrgEvent {
  id: string; event_name: string; category: string; description: string;
  date: string; time: string; venue: string; address: string; city: string;
  status: string; total_sold: number; banner_url: string | null; banner_color: string;
  organizer_id: string; tiers: Tier[];
}

function TierProgress({ tier }: { tier: Tier }) {
  const pct      = tier.available > 0 ? Math.round((tier.sold / tier.available) * 100) : 0;
  const remaining = tier.available - tier.sold;
  const isSoldOut  = remaining <= 0;
  const isLowStock = !isSoldOut && remaining <= Math.max(5, Math.ceil(tier.available * 0.1));

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{tier.name}</span>
          <span className="ml-2 text-xs" style={{ color: 'var(--color-text-dim)' }}>
            {tier.price === 0 ? 'Free' : formatNGN(tier.price)}
          </span>
        </div>
        {isSoldOut
          ? <Badge variant="gray">Sold Out</Badge>
          : isLowStock
          ? <Badge variant="amber">Low Stock</Badge>
          : null}
      </div>
      <div className="h-2 rounded-full overflow-hidden mb-1" style={{ backgroundColor: 'var(--color-border)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: isSoldOut ? 'var(--color-text-dim)' : isLowStock ? 'var(--color-amber)' : 'var(--color-purple)',
          }}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
        {tier.sold} / {tier.available} sold{!isSoldOut && ` — ${remaining} remaining`}
      </p>
    </div>
  );
}

function EditTierRow({
  tier, onSave, onCancel,
}: { tier: Tier; onSave: (updates: { price?: number; available?: number }) => Promise<void>; onCancel: () => void; }) {
  const [price, setPrice]         = useState(String(tier.price));
  const [available, setAvailable] = useState(String(tier.available));
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      price:     Number(price),
      available: Number(available),
    });
    setSaving(false);
  };

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-purple)', backgroundColor: 'var(--color-purple-dim)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{tier.name}</p>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Price (NGN, 0 = Free)"
          type="number"
          value={price}
          onChange={e => setPrice(e.target.value)}
          min="0"
        />
        <Input
          label={`Quantity (min ${tier.sold})`}
          type="number"
          value={available}
          onChange={e => setAvailable(e.target.value)}
          min={String(tier.sold)}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={saving} onClick={handleSave}><Check size={13} />Save</Button>
        <Button size="sm" variant="outline" disabled={saving} onClick={onCancel}><X size={13} />Cancel</Button>
      </div>
    </div>
  );
}

export default function OrganizerEventDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const router     = useRouter();
  const { toast }  = useToast();

  const [event, setEvent]         = useState<OrgEvent | null>(null);
  const [loading, setLoading]     = useState(true);
  const [editingInfo, setEditingInfo] = useState(false);
  const [description, setDescription] = useState('');
  const [address, setAddress]     = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [addingTier, setAddingTier] = useState(false);
  const [newTierName, setNewTierName] = useState('');
  const [newTierPrice, setNewTierPrice] = useState('');
  const [newTierQty, setNewTierQty]   = useState('');
  const [addingLoading, setAddingLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/organizer/events/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEvent(d.data);
          setDescription(d.data.description);
          setAddress(d.data.address);
        } else {
          toast(d.error || 'Event not found', 'error');
          router.push('/organizer/events');
        }
      })
      .catch(() => toast('Failed to load event', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (id) load(); }, [id]);

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      const res = await fetch(`/api/organizer/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, address }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Update failed', 'error'); return; }
      toast('Event updated', 'success');
      setEditingInfo(false);
      load();
    } finally {
      setSavingInfo(false);
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('banner', file);
    const res = await fetch(`/api/organizer/events/${id}/banner`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Upload failed', 'error'); return; }
    toast('Banner updated', 'success');
    load();
  };

  const handleSaveTier = async (tierId: string, updates: { price?: number; available?: number }) => {
    const res = await fetch(`/api/organizer/events/${id}/tiers/${tierId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Update failed', 'error'); return; }
    toast('Tier updated', 'success');
    setEditingTierId(null);
    load();
  };

  const handleAddTier = async () => {
    if (!newTierName || newTierQty === '') return;
    setAddingLoading(true);
    try {
      const res = await fetch(`/api/organizer/events/${id}/tiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTierName, price: newTierPrice || 0, quantity: newTierQty }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Failed to add tier', 'error'); return; }
      toast('Tier added', 'success');
      setAddingTier(false);
      setNewTierName(''); setNewTierPrice(''); setNewTierQty('');
      load();
    } finally {
      setAddingLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloadLoading(true);
    try {
      const res = await fetch(`/api/organizer/events/${id}/attendees`);
      if (!res.ok) { toast('Failed to generate attendee list', 'error'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `${event?.event_name ?? 'attendees'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading event...</p>
      </div>
    );
  }

  if (!event) return null;

  const isApproved    = event.status === 'approved';
  const totalAvailable = event.tiers.reduce((s, t) => s + t.available, 0);
  const totalSold      = event.tiers.reduce((s, t) => s + t.sold, 0);
  const allSoldOut     = totalAvailable > 0 && totalSold >= totalAvailable;

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {/* Back + header */}
      <div>
        <Link href="/organizer/events" className="inline-flex items-center gap-1.5 text-sm mb-4"
          style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={14} />Back to Events
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
              {event.event_name}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {formatShortDate(event.date)} &bull; {event.venue}, {event.city}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {allSoldOut && <Badge variant="gray">Sold Out</Badge>}
            {event.status === 'approved'    && <Badge variant="green">Live</Badge>}
            {event.status === 'under_review' && <Badge variant="amber">Under Review</Badge>}
            {event.status === 'rejected'     && <Badge variant="red">Rejected</Badge>}
            {event.status === 'completed'    && <Badge variant="blue">Completed</Badge>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Sold', value: totalSold.toLocaleString() },
          { label: 'Total Available', value: totalAvailable.toLocaleString() },
          { label: 'Gross Revenue', value: formatNGN(event.tiers.reduce((s, t) => s + t.price * t.sold, 0)) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border p-4"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Ticket tiers */}
      <div className="rounded-xl border p-5 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Ticket Tiers</h2>
          <Button size="sm" variant="outline" onClick={() => setAddingTier(v => !v)}>
            <Plus size={13} />Add Tier
          </Button>
        </div>

        {event.tiers.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No tiers configured.</p>
        )}

        {event.tiers.map(tier => (
          editingTierId === tier.id
            ? <EditTierRow
                key={tier.id}
                tier={tier}
                onSave={updates => handleSaveTier(tier.id, updates)}
                onCancel={() => setEditingTierId(null)}
              />
            : (
              <div key={tier.id} className="flex flex-col gap-2">
                <TierProgress tier={tier} />
                <button
                  className="self-start text-xs flex items-center gap-1"
                  style={{ color: 'var(--color-text-dim)' }}
                  onClick={() => setEditingTierId(tier.id)}
                >
                  <Pencil size={11} />Edit tier
                </button>
              </div>
            )
        ))}

        {addingTier && (
          <div className="rounded-lg border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>New Tier</p>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Name" value={newTierName} onChange={e => setNewTierName(e.target.value)} placeholder="e.g. VIP" />
              <Input label="Price (NGN, 0 = Free)" type="number" value={newTierPrice} onChange={e => setNewTierPrice(e.target.value)} placeholder="5000" min="0" />
              <Input label="Quantity" type="number" value={newTierQty} onChange={e => setNewTierQty(e.target.value)} placeholder="100" min="1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={addingLoading || !newTierName || !newTierQty} onClick={handleAddTier}>
                <Check size={13} />Add Tier
              </Button>
              <Button size="sm" variant="outline" disabled={addingLoading} onClick={() => { setAddingTier(false); setNewTierName(''); setNewTierPrice(''); setNewTierQty(''); }}>
                <X size={13} />Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Event info editing */}
      <div className="rounded-xl border p-5 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Event Details</h2>
            {isApproved && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                Name and date are locked after approval. You can edit description and address.
              </p>
            )}
          </div>
          {!editingInfo && (
            <Button size="sm" variant="outline" onClick={() => setEditingInfo(true)}>
              <Pencil size={13} />Edit
            </Button>
          )}
        </div>

        {editingInfo ? (
          <div className="flex flex-col gap-4">
            <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} rows={4} />
            <Input label="Venue Address" value={address} onChange={e => setAddress(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" disabled={savingInfo} onClick={handleSaveInfo}><Check size={13} />Save</Button>
              <Button size="sm" variant="outline" disabled={savingInfo} onClick={() => { setEditingInfo(false); setDescription(event.description); setAddress(event.address); }}>
                <X size={13} />Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p style={{ color: 'var(--color-text-muted)' }}>{event.description}</p>
            <p className="mt-1" style={{ color: 'var(--color-text-dim)' }}>{event.address}, {event.city}</p>
          </div>
        )}
      </div>

      {/* Banner upload */}
      <div className="rounded-xl border p-5 flex flex-col gap-3"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Event Banner</h2>
        {event.banner_url && (
          <img src={event.banner_url} alt="Banner" className="w-full h-40 object-cover rounded-lg" />
        )}
        <input ref={bannerRef} type="file" accept="image/*" className="sr-only" onChange={handleBannerChange} />
        <Button size="sm" variant="outline" onClick={() => bannerRef.current?.click()}>
          <Upload size={13} />{event.banner_url ? 'Replace Banner' : 'Upload Banner'}
        </Button>
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Recommended: 1200x630px, max 5MB</p>
      </div>

      {/* Attendee download */}
      <div className="rounded-xl border p-5 flex items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Attendee List</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Download a CSV of all buyers including name, email, tier, quantity, date, and marketing consent.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={downloadLoading || totalSold === 0}
          onClick={handleDownload}
        >
          <Download size={13} />
          {downloadLoading ? 'Generating…' : 'Download CSV'}
        </Button>
      </div>

      {/* Warning if no sales yet */}
      {totalSold === 0 && (
        <div className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: '#f59e0b30', backgroundColor: '#f59e0b10', color: 'var(--color-amber)' }}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          No tickets sold yet — the attendee download will be available once sales begin.
        </div>
      )}

      {/* Link to public event page */}
      <div className="pb-4">
        <a
          href={`/events/${event.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--color-purple-light)' }}
        >
          <Ticket size={14} />View public event page
        </a>
      </div>
    </div>
  );
}
