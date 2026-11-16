'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MonitorLinksPanel } from '@/components/organizer/MonitorLinksPanel';
import { formatShortDate } from '@/lib/utils';

interface EventOption { id: string; name: string; date: string; status: string }

/**
 * Sponsor monitor links, reachable from the sidebar (056). Same panel as on
 * each event's page; pick the event, then create, copy or switch off links.
 */
export default function SponsorLinksPage() {
  const [events, setEvents] = useState<EventOption[] | null>(null);
  const [eventId, setEventId] = useState('');

  useEffect(() => {
    fetch('/api/organizer/events')
      .then(r => r.json())
      .then(d => {
        const list = ((d.success ? d.data : []) as EventOption[])
          .filter(e => e.status !== 'cancelled')
          // Upcoming first (soonest at the top), then past events, most recent first.
          .sort((a, b) => {
            const today = new Date().toISOString().slice(0, 10);
            const ua = a.date >= today, ub = b.date >= today;
            if (ua !== ub) return ua ? -1 : 1;
            return ua ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
          });
        setEvents(list);
        if (list[0]) setEventId(list[0].id);
      })
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          Sponsor links
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Give sponsors and partners a live, read-only view of an event&apos;s sales, without sharing your login.
        </p>
      </div>

      {events === null ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading your events&hellip;</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          You don&apos;t have any events yet. <Link href="/organizer/events/create" className="underline" style={{ color: 'var(--color-purple-light)' }}>Create one</Link> to start sharing.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sponsor-event" className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Event</label>
            <select id="sponsor-event" value={eventId} onChange={e => setEventId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              {events.map(e => (
                <option key={e.id} value={e.id}>{`${e.name} · ${formatShortDate(e.date)}`}</option>
              ))}
            </select>
          </div>
          {eventId && <MonitorLinksPanel key={eventId} eventId={eventId} />}
        </>
      )}
    </div>
  );
}
