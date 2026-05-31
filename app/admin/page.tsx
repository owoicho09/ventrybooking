'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarDays, Ticket, Wallet, UserCheck, MessageSquareWarning, Activity, ArrowRight,
} from 'lucide-react';
import { StatsCard } from '@/components/admin/StatsCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNGN, formatShortDate } from '@/lib/utils';

interface Stats {
  totalEvents: number;
  activeEvents: number;
  totalTicketsSold: number;
  revenueInEscrow: number;
  pendingKYC: number;
  openComplaints: number;
}

interface PendingOrg { id: string; name: string; submittedAt?: string; }
interface PendingEvent { id: string; name: string; organizer: { name: string }; date: string; }

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingOrgs, setPendingOrgs] = useState<PendingOrg[]>([]);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(d => { if (d.success) setStats(d.data); }).catch(console.error);
    fetch('/api/admin/organizers?status=pending').then(r => r.json()).then(d => { if (d.success) setPendingOrgs(d.data.slice(0, 5)); }).catch(console.error);
    fetch('/api/admin/events?status=under_review').then(r => r.json()).then(d => { if (d.success) setPendingEvents(d.data.slice(0, 5)); }).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          Admin Dashboard
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatsCard label="Total Events" value={stats?.totalEvents ?? '—'} icon={CalendarDays} trend="All time" />
        <StatsCard label="Active Events" value={stats?.activeEvents ?? '—'} icon={Activity} trend="Currently live" />
        <StatsCard label="Tickets Sold" value={stats ? stats.totalTicketsSold.toLocaleString() : '—'} icon={Ticket} trend="Across all events" />
        <StatsCard label="Revenue in Escrow" value={stats ? formatNGN(stats.revenueInEscrow) : '—'} icon={Wallet} accent trend="Held for active events" />
        <StatsCard label="Pending KYC" value={stats?.pendingKYC ?? '—'} icon={UserCheck} trend="Awaiting review" />
        <StatsCard label="Open Complaints" value={stats?.openComplaints ?? '—'} icon={MessageSquareWarning} trend="Needs attention" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>KYC Queue</h2>
            <Link href="/admin/organizers" className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {pendingOrgs.length === 0 && (
              <p className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>No pending KYC submissions</p>
            )}
            {pendingOrgs.map((org) => (
              <div key={org.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: 'var(--color-purple)' }}>
                  {org.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{org.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Submitted {org.submittedAt ? formatShortDate(org.submittedAt) : 'N/A'}
                  </p>
                </div>
                <Badge variant="amber">Pending</Badge>
                <Link href="/admin/organizers"><Button size="sm" variant="outline">Review</Button></Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Event Approval Queue</h2>
            <Link href="/admin/events" className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {pendingEvents.length === 0 && (
              <p className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>No events pending approval</p>
            )}
            {pendingEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{event.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    by {event.organizer.name} &middot; {formatShortDate(event.date)}
                  </p>
                </div>
                <Badge variant="amber">Under Review</Badge>
                <Link href="/admin/events"><Button size="sm" variant="outline">Review</Button></Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
