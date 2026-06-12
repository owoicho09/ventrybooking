'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Ticket, Wallet, CalendarDays, ArrowUpRight, Plus, Mail } from 'lucide-react';
import { StatsCard } from '@/components/admin/StatsCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatNGN, formatShortDate } from '@/lib/utils';

interface Stats { ticketsSold: number; revenueInEscrow: number; activeEvents: number; payoutDue: number; }
interface OrgEvent { id: string; name: string; date: string; totalSold: number; status: string; }
interface Me { name: string; verified: boolean; }

const statusBadge = (status: string) => {
  switch (status) {
    case 'approved': return <Badge variant="green">Approved</Badge>;
    case 'under_review': return <Badge variant="amber">Under Review</Badge>;
    case 'completed': return <Badge variant="blue">Completed</Badge>;
    default: return <Badge variant="gray">{status}</Badge>;
  }
};

export default function OrganizerDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/organizer/stats').then(r => r.json()),
      fetch('/api/organizer/events').then(r => r.json()),
      fetch('/api/organizer/me').then(r => r.json()),
    ]).then(([statsRes, eventsRes, meRes]) => {
      if (statsRes.success) setStats(statsRes.data);
      if (eventsRes.success) setEvents(eventsRes.data.slice(0, 5));
      if (meRes.success) setMe(meRes.data);
    }).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {me && !me.verified && (
        <div className="rounded-xl border px-5 py-4 flex items-start gap-4" style={{ backgroundColor: '#7c3aed15', borderColor: '#7c3aed40' }}>
          <Mail size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-purple-light)' }} />
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Verify your email to start creating events</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Check your inbox for the 6-digit code we sent when you registered.</p>
          </div>
          <Link href="/organizer/verify">
            <Button size="sm">Verify Now</Button>
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Welcome back{me ? `, ${me.name.split(' ')[0]}` : ''}
          </p>
        </div>
        <Link href="/organizer/events/create"><Button><Plus size={16} />Create Event</Button></Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard label="Tickets Sold" value={stats ? stats.ticketsSold.toLocaleString() : '—'} icon={Ticket} trend="Across all active events" />
        <StatsCard label="Revenue in Escrow" value={stats ? formatNGN(stats.revenueInEscrow) : '—'} icon={Wallet} trend="Protected until event day" accent />
        <StatsCard label="Active Events" value={stats ? stats.activeEvents : '—'} icon={CalendarDays} trend="Events currently live" />
        <StatsCard label="Payout Due" value={stats ? formatNGN(stats.payoutDue) : '—'} icon={ArrowUpRight} trend="Expected after event completion" />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Recent Events</h2>
          <Link href="/organizer/events" className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            View All <ArrowUpRight size={14} />
          </Link>
        </div>
        {events.length === 0 && (
          <p className="px-6 py-4 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>No events yet</p>
        )}
        {events.length > 0 && <Table>
          <Thead>
            <tr><Th>Event Name</Th><Th>Date</Th><Th>Tickets Sold</Th><Th>Status</Th><Th>Actions</Th></tr>
          </Thead>
          <Tbody>
            {events.map((event) => (
              <Tr key={event.id}>
                <Td><p className="font-medium" style={{ color: 'var(--color-text)' }}>{event.name}</p></Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(event.date)}</span></Td>
                <Td><span style={{ color: 'var(--color-text)' }}>{event.totalSold?.toLocaleString() ?? 0}</span></Td>
                <Td>{statusBadge(event.status)}</Td>
                <Td>
                  <Link href={`/events/${event.id}`} className="text-xs font-medium hover:underline" style={{ color: 'var(--color-purple-light)' }}>View</Link>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>}
      </div>

      <div className="rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center gap-4" style={{ borderColor: 'var(--color-border)' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
          <Plus size={20} />
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Create a New Event</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Set up ticket tiers, upload your event details, and go live.</p>
        </div>
        <Link href="/organizer/events/create"><Button>Create Event</Button></Link>
      </div>
    </div>
  );
}
