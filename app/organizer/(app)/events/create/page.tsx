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
import { compressImageFile } from '@/lib/compressImage';

interface Tier { id: string; name: string; price: string; quantity: string; }
type LineupLiability = 'headliner' | 'guest' | 'surprise';
interface LineupAct { id: string; name: string; role: string; liability: LineupLiability; photoFile?: File | null; photoPreview?: string; }

const LIABILITY_OPTIONS = [
  { value: 'guest', label: 'Guest Artist / Special Guest / Speaker' },
  { value: 'headliner', label: 'Headliner' },
  { value: 'surprise', label: 'Surprise Guest' },
];

const LIABILITY_HINT: Record<LineupLiability, string> = {
  headliner: "This is the single billed act the ticket is sold on — it carries refund liability if they don't perform. Only one allowed per event.",
  guest: 'Listed and promoted alongside the headliner — no refund exposure if they drop out.',
  surprise: "Listed on the page, but their name is never shown to buyers — you can still enter it here for your own record.",
};

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
  const [headerBanner, setHeaderBanner] = useState<File | null>(null);
  const [venueProof, setVenueProof] = useState<File | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([{ id: '1', name: 'Regular', price: '', quantity: '' }]);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [accentAutoDetected, setAccentAutoDetected] = useState(false);
  const [colorManuallySet, setColorManuallySet] = useState(false);

  const handleColorExtracted = (hex: string | null) => {
    if (colorManuallySet || !hex) return;
    setAccentColor(hex);
    setAccentAutoDetected(true);
  };
  const pickAccent = (hex: string | null) => {
    setColorManuallySet(true);
    setAccentAutoDetected(false);
    setAccentColor(hex);
  };
  const [lineup, setLineup] = useState<LineupAct[]>([]);
  const [restrictedDomainsInput, setRestrictedDomainsInput] = useState('');

  const addTier = () => setTiers(p => [...p, { id: Date.now().toString(), name: '', price: '', quantity: '' }]);
  const removeTier = (id: string) => { if (tiers.length > 1) setTiers(p => p.filter(t => t.id !== id)); };
  const updateTier = (id: string, field: keyof Tier, value: string) =>
    setTiers(p => p.map(t => (t.id === id ? { ...t, [field]: value } : t)));

  const addAct = () => setLineup(p => [...p, { id: Date.now().toString(), name: '', role: '', liability: 'guest' }]);
  const removeAct = (id: string) => setLineup(p => p.filter(a => a.id !== id));
  const updateAct = (id: string, field: 'name' | 'role', value: string) =>
    setLineup(p => p.map(a => (a.id === id ? { ...a, [field]: value } : a)));
  const updateLiability = (id: string, liability: LineupLiability) =>
    setLineup(p => p.map(a => {
      if (a.id === id) return { ...a, liability };
      // Only one Headliner allowed — picking a new one demotes the old one.
      if (liability === 'headliner' && a.liability === 'headliner') return { ...a, liability: 'guest' };
      return a;
    }));
  const updatePhoto = (id: string, file: File | null) =>
    setLineup(p => p.map(a => (a.id === id ? { ...a, photoFile: file, photoPreview: file ? URL.createObjectURL(file) : undefined } : a)));

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
        if (venueProof) fd.append('venueProof', await compressImageFile(venueProof));
      } else {
        fd.append('meetingLink', meetingLink);
        fd.append('meetingPasscode', meetingPasscode);
      }
      fd.append('tiers', JSON.stringify(tiers.map(t => ({ name: t.name, price: t.price, quantity: t.quantity }))));
      if (accentColor) fd.append('accentColor', accentColor);
      const domains = restrictedDomainsInput.split(',').map(d => d.trim()).filter(Boolean);
      if (domains.length) fd.append('allowedEmailDomains', JSON.stringify(domains));
      const validLineup = lineup.filter(a => a.name.trim() || a.liability === 'surprise');
      if (validLineup.length) {
        fd.append('lineup', JSON.stringify(validLineup.map(a => ({ name: a.name, role: a.role, liability: a.liability }))));
        for (let i = 0; i < validLineup.length; i++) {
          const a = validLineup[i];
          if (a.photoFile) fd.append(`lineupPhoto${i}`, await compressImageFile(a.photoFile));
        }
      }
      if (banner) fd.append('banner', banner);
      if (headerBanner) fd.append('headerBanner', headerBanner);

      // Vercel hard-caps the function request body at 4.5MB regardless of the
      // app's own per-file limits — this request can carry a flyer, header
      // banner, venue proof, and several lineup photos at once, so warn
      // before a doomed round trip instead of surfacing a bare network error.
      let totalBytes = 0;
      fd.forEach(v => { if (v instanceof File) totalBytes += v.size; });
      if (totalBytes > 4 * 1024 * 1024) {
        toast('Your images are too large to upload together — try smaller files for the venue proof or lineup photos.', 'error');
        return;
      }

      const res = await fetch('/api/organizer/events', { method: 'POST', body: fd });
      let data: { error?: string; data?: { eventId: string } };
      try {
        data = await res.json();
      } catch {
        toast(
          res.status === 413
            ? 'Your images are too large to upload together — try smaller files and try again.'
            : 'Something went wrong on our end. Please try again.',
          'error',
        );
        return;
      }
      if (!res.ok) {
        toast(data.error || 'Failed to create event', 'error');
        return;
      }
      toast('Your event is live! You can start sharing it right away.', 'success');
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
          label="Event Flyer"
          onCropped={setBanner}
          onColorExtracted={handleColorExtracted}
          buttonText={banner ? `${banner.name} — click to replace` : undefined}
        />
        <div>
          <BannerCropInput
            label="Event Page Header Banner (optional)"
            ratio={2}
            minWidth={1200}
            minHeight={600}
            safeZoneHint
            onCropped={setHeaderBanner}
            onColorExtracted={handleColorExtracted}
            buttonText={headerBanner ? `${headerBanner.name} — click to replace` : 'Click or drag to upload a wide header banner'}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-dim)' }}>
            A wide banner (2160×1080 recommended) shown as the fixed header on your event page — separate from the flyer above, which keeps doing its job on cards, previews, and ticket emails. Skip this and the page falls back to the flyer.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Accent Colour</label>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-dim)' }}>Threaded through your event page — the buy button, ticket tiers, prices and section icons. Auto-adjusted for readability in both themes. The Ventry masthead and checkout always stay Ventry purple.</p>
          {accentAutoDetected && accentColor && (
            <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-purple-light)' }}>
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: accentColor }} />
              Detected from your image — pick a swatch below to override.
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => pickAccent(null)}
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
                onClick={() => pickAccent(preset.hex)}
                className="w-9 h-9 rounded-full border-2"
                style={{
                  backgroundColor: preset.hex,
                  borderColor: accentColor === preset.hex ? 'var(--color-text)' : 'transparent',
                }}
                title={preset.name}
                aria-label={preset.name}
              />
            ))}
            {accentColor && !ACCENT_COLOR_PRESETS.some(p => p.hex === accentColor) && (
              <button
                type="button"
                className="w-9 h-9 rounded-full border-2"
                style={{ backgroundColor: accentColor, borderColor: 'var(--color-text)' }}
                title="Detected from your image"
                aria-label="Detected colour"
                disabled
              />
            )}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Restrict to Email Domains (optional)</label>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-dim)' }}>
            For closed events (e.g. a university-only event) — only buyers with an email at one of these domains can check out. Leave blank for a normal, open event.
          </p>
          <Input
            value={restrictedDomainsInput}
            onChange={e => setRestrictedDomainsInput(e.target.value)}
            placeholder="e.g. nileuniversity.edu.ng, unilag.edu.ng"
            helper="Comma-separated. No @ needed."
          />
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
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>
                Upload a lease agreement, booking confirmation, or receipt from the venue. Photos of the building are <strong>not</strong> accepted as proof.
              </p>
              <label className="flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3.5 cursor-pointer transition-colors hover:border-[var(--color-purple)]" style={{ borderColor: 'var(--color-border)' }}>
                <input type="file" className="sr-only" accept=".pdf,image/*" onChange={e => setVenueProof(e.target.files?.[0] ?? null)} />
                <Upload size={16} style={{ color: 'var(--color-text-dim)' }} />
                <span className="text-sm" style={{ color: venueProof ? 'var(--color-green)' : 'var(--color-text-muted)' }}>
                  {venueProof ? venueProof.name : 'Upload lease agreement, booking confirmation, or receipt'}
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
            <div key={act.id} className="rounded-lg border p-3 flex flex-col gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <div className="flex items-start gap-3">
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <Input label="Name" value={act.name} onChange={e => updateAct(act.id, 'name', e.target.value)} placeholder="e.g. Burna Boy" />
                  <Input label="Role" value={act.role} onChange={e => updateAct(act.id, 'role', e.target.value)} placeholder="e.g. DJ, Opening Act" />
                </div>
                <button type="button" onClick={() => removeAct(act.id)} className="mt-5" style={{ color: 'var(--color-red)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
              <Select
                label="Billing"
                options={LIABILITY_OPTIONS}
                value={act.liability}
                onChange={e => updateLiability(act.id, e.target.value as LineupLiability)}
              />
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{LIABILITY_HINT[act.liability]}</p>
              <label className="flex items-center gap-3 text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                {act.photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={act.photoPreview} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface)' }}><Upload size={13} /></span>
                )}
                <input type="file" className="sr-only" accept="image/*" onChange={e => updatePhoto(act.id, e.target.files?.[0] ?? null)} />
                {act.photoPreview ? 'Change photo' : 'Add photo (optional)'}
              </label>
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
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>5. Review & Publish</h2>
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
          <p className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Summary</p>
          <p>Event: {name || '(not set)'}</p>
          <p className="mt-1">Tiers: {tiers.length} tier{tiers.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="rounded-lg px-4 py-3 flex items-start gap-3 text-sm" style={{ backgroundColor: '#10b98110', border: '1px solid #10b98130' }}>
          <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-green)' }}>✓</span>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Your event goes <strong style={{ color: 'var(--color-text)' }}>live immediately</strong> after you submit — no waiting. Our team reviews new events shortly after publishing and may reach out if anything needs your attention.
          </p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
          By listing this event you agree to Ventry&apos;s{' '}
          <Link href="/terms/organisers" className="underline" style={{ color: 'var(--color-text-muted)' }}>Organiser Terms of Use</Link>.
        </p>
        <Button type="submit" size="lg" fullWidth disabled={loading}>
          {loading ? 'Publishing...' : 'Publish Event'}
        </Button>
      </section>
    </form>
  );
}
