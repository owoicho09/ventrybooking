'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ACCENT_COLOR_PRESETS } from '@/lib/accentColors';
import { BannerCropInput } from '@/components/organizer/BannerCropInput';

interface Tier { id: string; name: string; price: string; quantity: string; }
interface LineupAct { id: string; name: string; role: string; }

const eventTypes = [
  { value: 'Concert', label: 'Concert' },
  { value: 'Party', label: 'Party' },
  { value: 'Festival', label: 'Festival' },
  { value: 'Sports', label: 'Sports' },
  { value: 'Theater', label: 'Theater' },
  { value: 'Conference', label: 'Conference' },
  { value: 'Other', label: 'Other' },
];

export default function CreateEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Concert');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [eventMode, setEventMode] = useState<'physical' | 'online'>('physical');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locationHidden, setLocationHidden] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingPasscode, setMeetingPasscode] = useState('');
  const [banner, setBanner] = useState<File | null>(null);
  const [venueProof, setVenueProof] = useState<File | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([{ id: '1', name: 'Regular', price: '', quantity: '' }]);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [lineup, setLineup] = useState<LineupAct[]>([]);

  const addTier = () => setTiers(p => [...p, { id: Date.now().toString(), name: '', price: '', quantity: '' }]);
  const removeTier = (id: string) => { if (tiers.length > 1) setTiers(p => p.filter(t => t.id !== id)); };
  const updateTier = (id: string, field: keyof Tier, value: string) =>
    setTiers(p => p.map(t => (t.id === id ? { ...t, [field]: value } : t)));

  const addAct = () => setLineup(p => [...p, { id: Date.now().toString(), name: '', role: '' }]);
  const removeAct = (id: string) => setLineup(p => p.filter(a => a.id !== id));
  const updateAct = (id: string, field: keyof LineupAct, value: string) =>
    setLineup(p => p.map(a => (a.id === id ? { ...a, [field]: value } : a)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('category', category);
      fd.append('description', description);
      fd.append('date', date);
      fd.append('time', time);
      fd.append('eventMode', eventMode);
      if (eventMode === 'physical') {
        fd.append('venue', venue);
        fd.append('address', address);
        fd.append('city', city);
        fd.append('landmark', landmark);
        fd.append('locationHidden', String(locationHidden));
        if (venueProof) fd.append('venueProof', venueProof);
      } else {
        fd.append('meetingLink', meetingLink);
        fd.append('meetingPasscode', meetingPasscode);
      }
      fd.append('tiers', JSON.stringify(tiers.map(t => ({ name: t.name, price: t.price, quantity: t.quantity }))));
      if (accentColor) fd.append('accentColor', accentColor);
      const validLineup = lineup.filter(a => a.name.trim());
      if (validLineup.length) fd.append('lineup', JSON.stringify(validLineup.map(a => ({ name: a.name, role: a.role }))));
      if (banner) fd.append('banner', banner);

      const res = await fetch('/api/organizer/events', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Failed to create event', 'error');
        return;
      }
      toast('Event submitted for review! We\'ll notify you within 2–4 business days.', 'success');
      router.push('/organizer/events');
    } catch {
      toast('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Create Event</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Fill in all sections and submit for review.</p>
      </div>

      <section className="rounded-xl border p-6 flex flex-col gap-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>1. Event Details</h2>
        <Input label="Event Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Afrobeat Vibes Festival 2026" required />
        <Select label="Event Type" options={eventTypes} value={category} onChange={e => setCategory(e.target.value)} />
        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell attendees what to expect..." rows={4} />
        <BannerCropInput
          label="Event Banner"
          onCropped={setBanner}
          buttonText={banner ? `${banner.name} — click to replace` : undefined}
        />
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Accent Colour</label>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-dim)' }}>Applied to your ticket panel — tier cards, purchase button, and quantity steppers. Everything else stays Ventry purple.</p>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setAccentColor(null)}
              className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold"
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
                style={{
                  backgroundColor: preset.hex,
                  borderColor: accentColor === preset.hex ? 'var(--color-text)' : 'transparent',
                }}
                title={preset.name}
                aria-label={preset.name}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>2. Date & Location</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Event Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Input label="Start Time" type="time" value={time} onChange={e => setTime(e.target.value)} required />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Event Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEventMode('physical')}
              className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors"
              style={{
                borderColor: eventMode === 'physical' ? 'var(--color-purple)' : 'var(--color-border)',
                backgroundColor: eventMode === 'physical' ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
                color: eventMode === 'physical' ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
              }}
            >
              Physical
              <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Happens at a venue</span>
            </button>
            <button
              type="button"
              onClick={() => setEventMode('online')}
              className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors"
              style={{
                borderColor: eventMode === 'online' ? 'var(--color-purple)' : 'var(--color-border)',
                backgroundColor: eventMode === 'online' ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
                color: eventMode === 'online' ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
              }}
            >
              Online
              <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Hosted via a meeting link (e.g. Zoom)</span>
            </button>
          </div>
        </div>

        {eventMode === 'physical' ? (
          <>
            <Input label="Venue Name" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Eko Atlantic City Arena" required />
            <Input label="Venue Address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full street address" required />
            <Input label="City" value={city} onChange={e => setCity(e.target.value)} placeholder="Lagos" required />
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
                Hide exact venue and address from the public event page until I reveal it. Admins and ticket buyers will still receive exact location updates.
              </span>
            </label>
            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Venue Proof Document</label>
              <label className="flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3.5 cursor-pointer transition-colors hover:border-[var(--color-purple)]" style={{ borderColor: 'var(--color-border)' }}>
                <input type="file" className="sr-only" accept=".pdf,image/*" onChange={e => setVenueProof(e.target.files?.[0] ?? null)} />
                <Upload size={16} style={{ color: 'var(--color-text-dim)' }} />
                <span className="text-sm" style={{ color: venueProof ? 'var(--color-green)' : 'var(--color-text-muted)' }}>
                  {venueProof ? venueProof.name : 'Upload venue booking confirmation or rental agreement'}
                </span>
              </label>
            </div>
          </>
        ) : (
          <>
            <Input label="Meeting Link" value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://zoom.us/j/..." required />
            <Input label="Passcode (optional)" value={meetingPasscode} onChange={e => setMeetingPasscode(e.target.value)} placeholder="e.g. 482913" />
            <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
              Ticket buyers never see this link directly on Ventry — it&apos;s emailed to them automatically before the event starts, along with their reminders.
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>3. Lineup (optional)</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Performers, speakers, or hosts — shown on the event page above ticket selection.</p>
        </div>
        <div className="flex flex-col gap-3">
          {lineup.map(act => (
            <div key={act.id} className="rounded-lg border p-3 flex items-center gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <div className="grid grid-cols-2 gap-3 flex-1">
                <Input label="Name" value={act.name} onChange={e => updateAct(act.id, 'name', e.target.value)} placeholder="e.g. Burna Boy" />
                <Input label="Role" value={act.role} onChange={e => updateAct(act.id, 'role', e.target.value)} placeholder="e.g. Headliner" />
              </div>
              <button type="button" onClick={() => removeAct(act.id)} className="mt-5" style={{ color: 'var(--color-red)' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addAct} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
          <Plus size={16} />Add Lineup Act
        </button>
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>4. Ticket Tiers</h2>
        <div className="flex flex-col gap-4">
          {tiers.map((tier) => (
            <div key={tier.id} className="rounded-lg border p-4 flex flex-col gap-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Tier</p>
                {tiers.length > 1 && (
                  <button type="button" onClick={() => removeTier(tier.id)} className="text-xs flex items-center gap-1" style={{ color: 'var(--color-red)' }}>
                    <Trash2 size={13} />Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Tier Name" value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} placeholder="e.g. VIP" />
                <Input label="Price (NGN)" type="number" value={tier.price} onChange={e => updateTier(tier.id, 'price', e.target.value)} placeholder="5000" />
                <Input label="Quantity" type="number" value={tier.quantity} onChange={e => updateTier(tier.id, 'quantity', e.target.value)} placeholder="500" />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addTier} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
          <Plus size={16} />Add Another Tier
        </button>
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>5. Review & Submit</h2>
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
          <p className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Summary</p>
          <p>Event: {name || '(not set)'}</p>
          <p className="mt-1">Tiers: {tiers.length} tier{tiers.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="rounded-lg px-4 py-3 flex items-start gap-3 text-sm" style={{ backgroundColor: '#f59e0b10', border: '1px solid #f59e0b30' }}>
          <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-amber)' }}>!</span>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Your event will be reviewed within <strong style={{ color: 'var(--color-text)' }}>2-4 business days</strong> before going live.
          </p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
          By listing this event you agree to Ventry&apos;s{' '}
          <Link href="/terms/organisers" className="underline" style={{ color: 'var(--color-text-muted)' }}>Organiser Terms of Use</Link>.
        </p>
        <Button type="submit" size="lg" fullWidth disabled={loading}>
          {loading ? 'Submitting...' : 'Submit for Review'}
        </Button>
      </section>
    </form>
  );
}
