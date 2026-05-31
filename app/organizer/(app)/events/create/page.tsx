'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface Tier { id: string; name: string; price: string; quantity: string; }

const eventTypes = [
  { value: 'Concert', label: 'Concert' },
  { value: 'Uni Party', label: 'Uni Party' },
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
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [banner, setBanner] = useState<File | null>(null);
  const [venueProof, setVenueProof] = useState<File | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([{ id: '1', name: 'Regular', price: '', quantity: '' }]);

  const addTier = () => setTiers(p => [...p, { id: Date.now().toString(), name: '', price: '', quantity: '' }]);
  const removeTier = (id: string) => { if (tiers.length > 1) setTiers(p => p.filter(t => t.id !== id)); };
  const updateTier = (id: string, field: keyof Tier, value: string) =>
    setTiers(p => p.map(t => (t.id === id ? { ...t, [field]: value } : t)));

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
      fd.append('venue', venue);
      fd.append('address', address);
      fd.append('city', city);
      fd.append('tiers', JSON.stringify(tiers.map(t => ({ name: t.name, price: t.price, quantity: t.quantity }))));
      if (banner) fd.append('banner', banner);
      if (venueProof) fd.append('venueProof', venueProof);

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
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Event Banner</label>
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors hover:border-[var(--color-purple)]" style={{ borderColor: 'var(--color-border)' }}>
            <input type="file" className="sr-only" accept="image/*" onChange={e => setBanner(e.target.files?.[0] ?? null)} />
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}><Upload size={18} /></div>
            <div className="text-center">
              <p className="text-sm" style={{ color: banner ? 'var(--color-green)' : 'var(--color-text-muted)' }}>{banner ? banner.name : 'Click or drag to upload event banner'}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Recommended: 1200x630px, max 5MB</p>
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>2. Date & Venue</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Event Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Input label="Start Time" type="time" value={time} onChange={e => setTime(e.target.value)} required />
        </div>
        <Input label="Venue Name" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Eko Atlantic City Arena" required />
        <Input label="Venue Address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full street address" required />
        <Input label="City" value={city} onChange={e => setCity(e.target.value)} placeholder="Lagos" required />
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
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>3. Ticket Tiers</h2>
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
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>4. Review & Submit</h2>
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
        <Button type="submit" size="lg" fullWidth disabled={loading}>
          {loading ? 'Submitting...' : 'Submit for Review'}
        </Button>
      </section>
    </form>
  );
}
