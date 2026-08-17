'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Download, Plus, Pencil, Check, X,
  AlertTriangle, Ticket, Copy, Eye, EyeOff, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { formatNGN, formatShortDate } from '@/lib/utils';
import { ACCENT_COLOR_PRESETS } from '@/lib/accentColors';
import { BannerCropInput } from '@/components/organizer/BannerCropInput';

interface Tier { id: string; name: string; price: number; available: number; sold: number; }
interface Affiliate { id: string; name: string; code: string; link: string; clicks: number; buys: number; }
interface LineupAct { name: string; role: string; }
interface OrgEvent {
  id: string; slug: string; event_name: string; category: string; description: string;
  date: string; time: string; event_mode: 'physical' | 'online'; venue: string; address: string; city: string;
  landmark: string | null; location_hidden: boolean;
  meeting_link: string | null; meeting_passcode: string | null;
  status: string; total_sold: number; banner_url: string | null; banner_color: string;
  accent_color: string | null; lineup: LineupAct[];
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
  const [venue, setVenue] = useState('');
  const [address, setAddress]     = useState('');
  const [city, setCity] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locationHidden, setLocationHidden] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingPasscode, setMeetingPasscode] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [addingTier, setAddingTier] = useState(false);
  const [newTierName, setNewTierName] = useState('');
  const [newTierPrice, setNewTierPrice] = useState('');
  const [newTierQty, setNewTierQty]   = useState('');
  const [addingLoading, setAddingLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [newAffiliateName, setNewAffiliateName] = useState('');
  const [addingAffiliate, setAddingAffiliate] = useState(false);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [lineup, setLineup] = useState<LineupAct[]>([]);
  const [savingBranding, setSavingBranding] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/organizer/events/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEvent(d.data);
          setDescription(d.data.description);
          setVenue(d.data.venue);
          setAddress(d.data.address);
          setCity(d.data.city);
          setLandmark(d.data.landmark ?? '');
          setLocationHidden(Boolean(d.data.location_hidden));
          setMeetingLink(d.data.meeting_link ?? '');
          setMeetingPasscode(d.data.meeting_passcode ?? '');
          setAccentColor(d.data.accent_color ?? null);
          setLineup(d.data.lineup ?? []);
        } else {
          toast(d.error || 'Event not found', 'error');
          router.push('/organizer/events');
        }
      })
      .catch(() => toast('Failed to load event', 'error'))
      .finally(() => setLoading(false));
  };

  const loadAffiliates = () => {
    fetch(`/api/organizer/events/${id}/affiliates`)
      .then(r => r.json())
      .then(d => { if (d.success) setAffiliates(d.data); })
      .catch(() => {});
  };

  useEffect(() => { if (id) { load(); loadAffiliates(); } }, [id]);

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      const res = await fetch(`/api/organizer/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          event?.event_mode === 'online'
            ? { description, meeting_link: meetingLink, meeting_passcode: meetingPasscode }
            : { description, venue, address, city, landmark, location_hidden: locationHidden },
        ),
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

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const res = await fetch(`/api/organizer/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accent_color: accentColor, lineup: lineup.filter(a => a.name.trim()) }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Update failed', 'error'); return; }
      toast('Branding updated', 'success');
      load();
    } finally {
      setSavingBranding(false);
    }
  };

  const addAct = () => setLineup(p => [...p, { name: '', role: '' }]);
  const removeAct = (index: number) => setLineup(p => p.filter((_, i) => i !== index));
  const updateAct = (index: number, field: keyof LineupAct, value: string) =>
    setLineup(p => p.map((a, i) => (i === index ? { ...a, [field]: value } : a)));

  const handleBannerChange = async (file: File) => {
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
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleAddAffiliate = async () => {
    if (!newAffiliateName.trim()) return;
    setAddingAffiliate(true);
    try {
      const res = await fetch(`/api/organizer/events/${id}/affiliates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAffiliateName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Failed to add affiliate', 'error'); return; }
      toast('Affiliate added', 'success');
      setNewAffiliateName('');
      loadAffiliates();
    } finally {
      setAddingAffiliate(false);
    }
  };

  const handleCopyAffiliateLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Affiliate link copied', 'success');
    } catch {
      toast('Could not copy link', 'error');
    }
  };

  const handleCopyLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/${event?.slug ?? `events/${id}`}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Ticket link copied', 'success');
    } catch {
      toast('Could not copy link', 'error');
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
              {formatShortDate(event.date)} &bull; {event.event_mode === 'online' ? 'Online Event' : `${event.venue}, ${event.city}`}
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
                Name and date are locked after approval. You can edit description and location details.
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
            {event.event_mode === 'online' ? (
              <>
                <Input label="Meeting Link" value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://zoom.us/j/..." />
                <Input label="Passcode (optional)" value={meetingPasscode} onChange={e => setMeetingPasscode(e.target.value)} placeholder="e.g. 482913" />
                <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                  If you change this link after tickets are already sold, buyers who already received the old link will be emailed the new one.
                </div>
              </>
            ) : (
              <>
                <Input label="Venue Name" value={venue} onChange={e => setVenue(e.target.value)} />
                <Input label="Venue Address" value={address} onChange={e => setAddress(e.target.value)} />
                <Input label="City" value={city} onChange={e => setCity(e.target.value)} />
                <Input label="Nearby Landmark" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="e.g. Landmark Towers, Victoria Island" />
                <label className="flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                  <input
                    type="checkbox"
                    checked={locationHidden}
                    onChange={e => setLocationHidden(e.target.checked)}
                    className="mt-0.5 flex-shrink-0 w-4 h-4 rounded accent-[var(--color-purple)]"
                  />
                  <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    Hide exact venue and address on the public event page until I reveal it.
                  </span>
                </label>
              </>
            )}
            <div className="flex gap-2">
              <Button size="sm" disabled={savingInfo} onClick={handleSaveInfo}><Check size={13} />Save</Button>
              <Button size="sm" variant="outline" disabled={savingInfo} onClick={() => {
                setEditingInfo(false);
                setDescription(event.description);
                setVenue(event.venue);
                setAddress(event.address);
                setCity(event.city);
                setLandmark(event.landmark ?? '');
                setLocationHidden(Boolean(event.location_hidden));
                setMeetingLink(event.meeting_link ?? '');
                setMeetingPasscode(event.meeting_passcode ?? '');
              }}>
                <X size={13} />Cancel
              </Button>
            </div>
          </div>
        ) : event.event_mode === 'online' ? (
          <div className="flex flex-col gap-2 text-sm">
            <p style={{ color: 'var(--color-text-muted)' }}>{event.description}</p>
            <p style={{ color: 'var(--color-text-dim)' }}>Meeting link: {event.meeting_link || 'Not set'}</p>
            {event.meeting_passcode && (
              <p style={{ color: 'var(--color-text-dim)' }}>Passcode: {event.meeting_passcode}</p>
            )}
            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              Not shown to buyers on Ventry — delivered automatically by email before the event.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p style={{ color: 'var(--color-text-muted)' }}>{event.description}</p>
            <div className="mt-1 flex items-center gap-2" style={{ color: event.location_hidden ? 'var(--color-amber)' : 'var(--color-green)' }}>
              {event.location_hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{event.location_hidden ? 'Exact location hidden from public page' : 'Exact location visible publicly'}</span>
            </div>
            <p style={{ color: 'var(--color-text-dim)' }}>{event.venue}</p>
            <p style={{ color: 'var(--color-text-dim)' }}>{event.address}, {event.city}</p>
            {event.landmark && (
              <p style={{ color: 'var(--color-text-dim)' }}>Landmark: {event.landmark}</p>
            )}
          </div>
        )}
      </div>

      {/* Banner upload */}
      <div className="rounded-xl border p-5 flex flex-col gap-3"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <BannerCropInput
          label="Event Banner"
          currentUrl={event.banner_url}
          onCropped={handleBannerChange}
          buttonText={event.banner_url ? 'Click to replace banner' : undefined}
        />
      </div>

      {/* Accent colour + lineup */}
      <div className="rounded-xl border p-5 flex flex-col gap-5"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Branding</h2>

        <div>
          <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>Accent Colour</p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-dim)' }}>Applied to your ticket panel — tier cards, purchase button, and quantity steppers.</p>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setAccentColor(null)}
              className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[9px] font-semibold"
              style={{
                borderColor: accentColor === null ? 'var(--color-text)' : 'var(--color-border)',
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
              }}
              title="Default (Ventry Purple)"
            >
              Default
            </button>
            {ACCENT_COLOR_PRESETS.map(preset => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => setAccentColor(preset.hex)}
                className="w-9 h-9 rounded-full border-2"
                style={{ backgroundColor: preset.hex, borderColor: accentColor === preset.hex ? 'var(--color-text)' : 'transparent' }}
                title={preset.name}
                aria-label={preset.name}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>Lineup</p>
          <div className="flex flex-col gap-2 mb-2">
            {lineup.map((act, i) => (
              <div key={i} className="rounded-lg border p-3 flex items-center gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <Input label="Name" value={act.name} onChange={e => updateAct(i, 'name', e.target.value)} placeholder="e.g. Burna Boy" />
                  <Input label="Role" value={act.role} onChange={e => updateAct(i, 'role', e.target.value)} placeholder="e.g. Headliner" />
                </div>
                <button type="button" onClick={() => removeAct(i)} className="mt-5" style={{ color: 'var(--color-red)' }}><X size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addAct} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
            <Plus size={16} />Add Lineup Act
          </button>
        </div>

        <Button size="sm" disabled={savingBranding} onClick={handleSaveBranding} className="self-start">
          {savingBranding ? 'Saving…' : 'Save Branding'}
        </Button>
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

      {/* Affiliates */}
      <div className="rounded-xl border p-5 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Users size={16} />Affiliates
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Give a marketer a named tracking link for this event. You'll see clicks and completed purchases per affiliate — never buyer details.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              value={newAffiliateName}
              onChange={e => setNewAffiliateName(e.target.value)}
              placeholder="e.g. Tunde or ABC Promotions"
            />
          </div>
          <Button size="sm" disabled={addingAffiliate || !newAffiliateName.trim()} onClick={handleAddAffiliate}>
            <Plus size={13} />Add Affiliate
          </Button>
        </div>

        {affiliates.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No affiliates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="py-2 pr-3 font-medium" style={{ color: 'var(--color-text-dim)' }}>Name</th>
                  <th className="py-2 pr-3 font-medium" style={{ color: 'var(--color-text-dim)' }}>Link</th>
                  <th className="py-2 pr-3 font-medium text-right" style={{ color: 'var(--color-text-dim)' }}>Clicks</th>
                  <th className="py-2 pl-3 font-medium text-right" style={{ color: 'var(--color-text-dim)' }}>Purchases</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map(a => (
                  <tr key={a.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-2.5 pr-3 whitespace-nowrap" style={{ color: 'var(--color-text)' }}>{a.name}</td>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => handleCopyAffiliateLink(a.link)}
                        className="inline-flex items-center gap-1.5 max-w-[220px] sm:max-w-xs"
                        style={{ color: 'var(--color-purple-light)' }}
                      >
                        <Copy size={12} className="flex-shrink-0" />
                        <span className="truncate">{a.link}</span>
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 text-right" style={{ color: 'var(--color-text)' }}>{a.clicks.toLocaleString()}</td>
                    <td className="py-2.5 pl-3 text-right font-medium" style={{ color: 'var(--color-text)' }}>{a.buys.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/${event.slug || `events/${event.id}`}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--color-purple-light)' }}
          >
            <Ticket size={14} />View public event page
          </a>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Copy size={14} />Copy ticket link
          </button>
        </div>
      </div>
    </div>
  );
}
