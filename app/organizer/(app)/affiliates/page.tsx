'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Share2, Plus, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

interface Affiliate {
  id: string;
  name: string;
  code: string;
  link: string;
  clicks: number;
  buys: number;
  eventId: string;
  eventName: string;
}

interface EventOption { id: string; name: string; status: string; }

export default function OrganizerAffiliatesPage() {
  const { toast } = useToast();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [newAffiliateName, setNewAffiliateName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => {
    Promise.all([
      fetch('/api/organizer/affiliates').then(r => r.json()),
      fetch('/api/organizer/events').then(r => r.json()),
    ]).then(([aff, ev]) => {
      if (aff.success) setAffiliates(aff.data);
      if (ev.success) {
        setEvents(ev.data);
        const active = (ev.data as EventOption[]).filter((e) => e.status === 'approved');
        setSelectedEventId(prev => (prev && active.some(e => e.id === prev)) ? prev : (active[0]?.id || ''));
      }
    }).catch(() => toast('Failed to load affiliates', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeEvents = events.filter(e => e.status === 'approved');

  const handleAdd = async () => {
    if (!selectedEventId || !newAffiliateName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/organizer/events/${selectedEventId}/affiliates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAffiliateName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Failed to add affiliate', 'error'); return; }
      toast('Affiliate added', 'success');
      setNewAffiliateName('');
      load();
    } finally {
      setAdding(false);
    }
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Affiliate link copied', 'success');
    } catch {
      toast('Could not copy link', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading affiliates...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          <Share2 size={22} />Affiliates
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Give marketers named tracking links per event, and see clicks and completed purchases per affiliate — never buyer details.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          You need to create an event before you can add affiliates.{' '}
          <Link href="/organizer/events/create" style={{ color: 'var(--color-purple-light)' }}>Create your first event</Link>.
        </div>
      ) : activeEvents.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          None of your events are live yet — affiliate links can only be created for approved events.{' '}
          <Link href="/organizer/events" style={{ color: 'var(--color-purple-light)' }}>Check your events&apos; status</Link>.
        </div>
      ) : (
        <div className="rounded-xl border p-5 flex flex-col gap-4"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Add Affiliate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <Select
              label="Event"
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              options={activeEvents.map(e => ({ value: e.id, label: e.name }))}
            />
            <Input
              label="Affiliate Name"
              value={newAffiliateName}
              onChange={e => setNewAffiliateName(e.target.value)}
              placeholder="e.g. Tunde or ABC Promotions"
            />
            <Button disabled={adding || !selectedEventId || !newAffiliateName.trim()} onClick={handleAdd}>
              <Plus size={13} />Add
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        {affiliates.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>No affiliates yet.</p>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Event</Th>
                <Th>Name</Th>
                <Th>Link</Th>
                <Th className="text-right">Clicks</Th>
                <Th className="text-right">Purchases</Th>
              </Tr>
            </Thead>
            <Tbody>
              {affiliates.map(a => (
                <Tr key={a.id}>
                  <Td>
                    <Link href={`/organizer/events/${a.eventId}`} className="hover:underline" style={{ color: 'var(--color-text)' }}>
                      {a.eventName}
                    </Link>
                  </Td>
                  <Td>{a.name}</Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(a.link)}
                      className="inline-flex items-center gap-1.5 max-w-[220px] sm:max-w-xs"
                      style={{ color: 'var(--color-purple-light)' }}
                    >
                      <Copy size={12} className="flex-shrink-0" />
                      <span className="truncate">{a.link}</span>
                    </button>
                  </Td>
                  <Td className="text-right">{a.clicks.toLocaleString()}</Td>
                  <Td className="text-right font-medium">{a.buys.toLocaleString()}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
