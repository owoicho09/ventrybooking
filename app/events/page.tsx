import '../v2.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { EventsBrowser } from '@/components/events/EventsBrowser';
import { getPublicEvents, cityCounts, organizerSummaries } from '@/lib/server/publicEvents';
import { todayWAT } from '@/lib/publicEvents';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'What’s on — Ventry',
  description: 'Verified events on sale across Nigeria: parties, concerts, theatre and conferences, with QR tickets that can’t be faked.',
};

export default async function EventsPage() {
  const events = await getPublicEvents();
  const today = todayWAT();
  // Only events that are actually upcoming or finished; an approved event
  // whose date has passed but hasn't been closed out yet isn't shown as on sale.
  const visible = events.filter(e => e.status === 'completed' || e.date >= today);
  const cities = cityCounts(visible);

  return (
    <div className="v2">
      <PublicNav />
      <div className="v-nav-spacer" />
      <Suspense fallback={<div style={{ minHeight: '70vh' }} />}>
        <EventsBrowser
          events={visible}
          today={today}
          cities={cities}
          organizers={organizerSummaries(visible)}
        />
      </Suspense>
      <Footer cities={cities.map(c => c.city)} />
    </div>
  );
}
