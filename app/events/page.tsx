'use client';

import { useState, useEffect } from 'react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { FilterBar } from '@/components/events/FilterBar';
import { EventGrid } from '@/components/events/EventGrid';

const categoryMap: Record<string, string> = {
  'Concerts':    'Concert',
  'Uni Parties': 'Uni Party',
  'Sports':      'Sports',
  'Theater':     'Theater',
  'Festivals':   'Festival',
  'Conferences': 'Conference',
};

export default function EventsPage() {
  const [query,    setQuery]    = useState('');
  const [category, setCategory] = useState('All');
  const [city,     setCity]     = useState('All Cities');
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query)                          params.set('q', query);
    const mapped = categoryMap[category];
    if (mapped)                         params.set('category', mapped);
    if (city && city !== 'All Cities')  params.set('city', city);

    fetch(`/api/events?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setEvents(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [query, category, city]);

  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />
      <div className="pt-16">
        <FilterBar
          onSearch={setQuery}
          onFilter={f => {
            setCategory(f.category);
            setCity(f.city);
          }}
        />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {loading
                ? 'Loading…'
                : <><span className="font-semibold" style={{ color: 'var(--color-text)' }}>{events.length}</span> events found</>}
            </p>
          </div>
          <EventGrid events={events} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
