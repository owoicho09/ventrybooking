'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AtSign, X as XIcon, Globe, Bell } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EventCard } from '@/components/events/EventCard';
import { eventsHostedLabel } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import type { Event } from '@/types';

interface StorefrontData {
  organizer: {
    name: string;
    handle: string;
    tier: string;
    verified: boolean;
    memberSince: string;
    bio: string | null;
    avatarUrl: string | null;
    socials: { instagram?: string; twitter?: string; website?: string };
    eventsHosted: number;
  };
  upcoming: Event[];
  past: Event[];
}

export function OrganizerStorefront({ handle }: { handle: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    fetch(`/api/organizers/${handle}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [handle]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribing(true);
    try {
      const res = await fetch(`/api/organizers/${handle}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error || 'Could not subscribe — please try again', 'error');
        return;
      }
      setSubscribed(true);
    } catch {
      toast('Network error. Please try again.', 'error');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-24 flex items-center justify-center"><p style={{ color: 'var(--color-text-muted)' }}>Loading…</p></div>
    </div>
  );

  if (notFound || !data) return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-24 text-center"><p style={{ color: 'var(--color-text-muted)' }}>Organiser not found.</p></div>
    </div>
  );

  const { organizer, upcoming, past } = data;

  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />
      <div className="pt-16 max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: 'var(--color-purple)' }}>
            {organizer.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={organizer.avatarUrl} alt={organizer.name} className="w-full h-full object-cover" />
              : organizer.name[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
                {organizer.name}
              </h1>
              {organizer.verified && <Badge variant="green"><CheckCircle size={11} />Verified</Badge>}
              <Badge variant="purple">{organizer.tier}</Badge>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Member since {new Date(organizer.memberSince).getFullYear()} &middot; {eventsHostedLabel(organizer.eventsHosted)}
            </p>
            {organizer.bio && (
              <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--color-text-muted)' }}>{organizer.bio}</p>
            )}
            {(organizer.socials.instagram || organizer.socials.twitter || organizer.socials.website) && (
              <div className="flex items-center gap-3 mt-3">
                {organizer.socials.instagram && (
                  <a href={organizer.socials.instagram} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-muted)' }}><AtSign size={16} /></a>
                )}
                {organizer.socials.twitter && (
                  <a href={organizer.socials.twitter} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-muted)' }}><XIcon size={16} /></a>
                )}
                {organizer.socials.website && (
                  <a href={organizer.socials.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-muted)' }}><Globe size={16} /></a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Upcoming Events</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No upcoming events right now.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {upcoming.map(event => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </div>

        {/* Past events */}
        {past.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Past Events</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {past.map(event => <EventCard key={event.id} event={event} variant="compact" />)}
            </div>
          </div>
        )}

        {/* Notify Me */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {subscribed ? (
            <p className="text-sm flex items-center gap-2" style={{ color: 'var(--color-green)' }}>
              <CheckCircle size={16} />You&apos;ll get an email when {organizer.name} announces a new event.
            </p>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 w-full">
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  <Bell size={14} />Get notified about {organizer.name}&apos;s next event
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={name} onChange={e => setName(e.target.value)} type="text" placeholder="Your name" required />
                  <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" required />
                  <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="Phone (optional)" />
                </div>
              </div>
              <Button type="submit" disabled={subscribing || !email || !name}>{subscribing ? 'Subscribing…' : 'Notify Me'}</Button>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
