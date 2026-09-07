'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { TicketCard } from '@/components/tickets/TicketCard';
import { buildTicket } from '@/lib/buildTicket';
import type { Ticket } from '@/types';

function TicketWithActions({ ticket }: { ticket: Ticket }) {
  return (
    <div className="flex flex-col gap-2">
      <TicketCard ticket={ticket} />
      <Link
        href={`/ticket/${ticket.id}?autoprint=1`}
        className="self-end flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--color-purple-light)' }}
      >
        <Download size={14} />Download ticket
      </Link>
    </div>
  );
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  useEffect(() => {
    fetch('/api/buyer/tickets')
      .then(r => r.json())
      .then(d => setTickets(d.success ? (d.data as Record<string, unknown>[]).map(buildTicket) : []))
      .catch(() => setTickets([]));
  }, []);

  if (tickets === null) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading your tickets…</p>;
  }

  if (tickets.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)' }}>
        No tickets yet — anything you buy with this email will show up here automatically.
      </p>
    );
  }

  const now = Date.now();
  const upcoming = tickets.filter(t => new Date(t.event.date).getTime() >= now);
  const past = tickets.filter(t => new Date(t.event.date).getTime() < now);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>No upcoming events.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {upcoming.map(t => <TicketWithActions key={t.id} ticket={t} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Past Events ({past.length})
        </h2>
        {past.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>No past events yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {past.map(t => <TicketWithActions key={t.id} ticket={t} />)}
          </div>
        )}
      </section>
    </div>
  );
}
