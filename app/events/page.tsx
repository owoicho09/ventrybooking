'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { FilterBar } from '@/components/events/FilterBar';
import { EventGrid } from '@/components/events/EventGrid';
import { Badge } from '@/components/ui/Badge';
import { eventsHostedLabel } from '@/lib/utils';
import type { Event } from '@/types';

interface OrganizerResult {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  verified: boolean;
  tier: string;
  eventsHosted: number;
}

// "This weekend" = the upcoming (or current, if today is already Sat/Sun) Saturday-Sunday pair.
function isThisWeekend(dateStr: string) {
  const eventDate = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dow = now.getDay(); // 0 = Sun .. 6 = Sat
  const daysToSaturday = dow === 0 ? -1 : 6 - dow;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysToSaturday);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  sunday.setHours(23, 59, 59, 999);
  return eventDate >= saturday && eventDate <= sunday;
}

function isThisMonth(dateStr: string) {
  const eventDate = new Date(dateStr);
  const now = new Date();
  return eventDate.getFullYear() === now.getFullYear() && eventDate.getMonth() === now.getMonth();
}

function minPrice(event: Event) {
  return event.tiers.length ? Math.min(...event.tiers.map(t => t.price)) : 0;
}

function applyDateFilter(list: Event[], date: string) {
  if (date === 'This Weekend') return list.filter(e => isThisWeekend(e.date));
  if (date === 'This Month')   return list.filter(e => isThisMonth(e.date));
  return list;
}

function applySort(list: Event[], sort: string) {
  const sorted = [...list];
  switch (sort) {
    case 'Most Popular':
      sorted.sort((a, b) => b.totalSold - a.totalSold);
      break;
    case 'Price Low':
      sorted.sort((a, b) => minPrice(a) - minPrice(b));
      break;
    case 'Price High':
      sorted.sort((a, b) => minPrice(b) - minPrice(a));
      break;
    case 'Soonest':
    default:
      sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
  return sorted;
}

export default function EventsPage() {
  const [query,    setQuery]    = useState('');
  const [category, setCategory] = useState('All');
  const [city,     setCity]     = useState('All Cities');
  const [date,     setDate]     = useState('All');
  const [sort,     setSort]     = useState('Soonest');
  const [events,   setEvents]   = useState<Event[]>([]);
  const [organizers, setOrganizers] = useState<OrganizerResult[]>([]);
  const [cities,   setCities]   = useState<string[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch('/api/events/cities')
      .then(r => r.json())
      .then(d => { if (d.success) setCities(d.data); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query)                          params.set('q', query);
    if (category && category !== 'All') params.set('category', category);
    if (city === 'Online')              params.set('mode', 'online');
    else if (city && city !== 'All Cities') params.set('city', city);

    fetch(`/api/events?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setEvents(d.data); setOrganizers(d.organizers ?? []); } })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [query, category, city]);

  const visibleEvents = useMemo(
    () => applySort(applyDateFilter(events, date), sort),
    [events, date, sort]
  );

  // Completed events are kept on the browse page (so it doesn't look scanty
  // once an organiser's events wrap up), but split into their own section
  // below the upcoming ones rather than interleaved by date, and shown most
  // recent first — the same convention as the organiser storefront page.
  const upcomingEvents = useMemo(() => visibleEvents.filter(e => e.status !== 'completed'), [visibleEvents]);
  const pastEvents = useMemo(
    () => [...visibleEvents.filter(e => e.status === 'completed')].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [visibleEvents]
  );

  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />
      <div className="pt-16">
        <FilterBar
          cities={cities}
          onSearch={setQuery}
          onFilter={f => {
            setCategory(f.category);
            setCity(f.city);
            setDate(f.date);
            setSort(f.sort);
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {query && organizers.length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Organisers</p>
              <div className="flex flex-wrap gap-3">
                {organizers.map(org => (
                  <Link
                    key={org.id}
                    href={`/${org.handle}`}
                    className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-[var(--color-purple)]"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: 'var(--color-purple)' }}>
                      {org.avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={org.avatarUrl} alt={org.name} className="w-full h-full object-cover" />
                        : org.name[0]}
                    </div>
                    <div>
                      <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {org.name}
                        {org.verified && <CheckCircle size={13} style={{ color: 'var(--color-green)' }} />}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{eventsHostedLabel(org.eventsHosted)}</span>
                    </div>
                    <Badge variant="purple">{org.tier}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {loading
                ? 'Loading…'
                : <><span className="font-semibold" style={{ color: 'var(--color-text)' }}>{visibleEvents.length}</span> events found</>}
            </p>
          </div>
          {(upcomingEvents.length > 0 || pastEvents.length === 0) && <EventGrid events={upcomingEvents} />}

          {pastEvents.length > 0 && (
            <div className="mt-12">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Past Events</h2>
              <EventGrid events={pastEvents} />
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
