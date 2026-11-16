import type { SupabaseClient } from '@supabase/supabase-js';
import { feeRateOf } from '@/lib/server/settlements';
import { isScheduled } from '@/lib/goLive';

/**
 * The read-only performance snapshot behind a sponsor monitor link (056).
 *
 * Figures match what the organiser sees on their own event page:
 *   - tickets sold / available come from the tiers;
 *   - net revenue is the organiser's net (tier price x sold, after their
 *     Ventry fee rate). No fee lines are shown.
 * Buyers, check-ins and the daily chart come from the ticket rows. Nothing
 * identifies a buyer: no names, emails, phones or references.
 */

export interface MonitorSnapshot {
  event: {
    name: string; date: string; time: string; mode: 'physical' | 'online';
    venue: string | null; city: string | null; bannerUrl: string | null;
    state: 'live' | 'scheduled' | 'under_review' | 'ended' | 'cancelled' | 'not_listed';
    goesLiveAt: string | null;
  };
  organizerName: string;
  label: string | null;
  totals: { ticketsSold: number; ticketsAvailable: number; netRevenue: number; buyers: number; checkedIn: number; validTickets: number; orders: number };
  tiers: { name: string; price: number; sold: number; available: number; netRevenue: number; checkedIn: number }[];
  daily: { date: string; tickets: number }[];
  recent: { tier: string; tickets: number; at: string }[];
  generatedAt: string;
}

/** YYYY-MM-DD in Nigeria time (UTC+1, no DST). */
const watDay = (iso: string) => new Date(new Date(iso).getTime() + 3600_000).toISOString().slice(0, 10);

type TicketRow = { tier_id: string; status: string; buyer_email: string | null; purchased_at: string; paystack_reference: string | null };

async function allTickets(db: SupabaseClient, eventId: string): Promise<TicketRow[]> {
  const out: TicketRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('tickets')
      .select('tier_id, status, buyer_email, purchased_at, paystack_reference')
      .eq('event_id', eventId)
      .in('status', ['valid', 'used'])
      .order('purchased_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as TicketRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function buildMonitorSnapshot(db: SupabaseClient, eventId: string, label: string | null): Promise<MonitorSnapshot | null> {
  const { data: ev } = await db
    .from('events')
    .select('event_name, date, time, event_mode, venue, city, banner_url, status, goes_live_at, organizer:users!events_organizer_id_fkey(name, platform_fee_rate), tiers:ticket_tiers(id, name, price, available, sold)')
    .eq('id', eventId)
    .maybeSingle();
  if (!ev) return null;

  const org = (Array.isArray(ev.organizer) ? ev.organizer[0] : ev.organizer) as { name: string | null; platform_fee_rate: number | null } | null;
  const rate = feeRateOf({ platform_fee_rate: org?.platform_fee_rate ?? null });
  const tiers = ((ev.tiers ?? []) as { id: string; name: string; price: number; available: number; sold: number }[])
    .sort((a, b) => Number(a.price) - Number(b.price));
  const tickets = await allTickets(db, eventId);

  const checkedInByTier = new Map<string, number>();
  for (const t of tickets) if (t.status === 'used') checkedInByTier.set(t.tier_id, (checkedInByTier.get(t.tier_id) ?? 0) + 1);

  const tierRows = tiers.map(t => ({
    name: t.name,
    price: Number(t.price),
    sold: t.sold,
    available: t.available,
    netRevenue: Math.round(Number(t.price) * t.sold * (1 - rate)),
    checkedIn: checkedInByTier.get(t.id) ?? 0,
  }));

  // Daily tickets, every day from the first sale to today (or the event day
  // once it's past), capped to the last 90 days so the chart stays readable.
  const perDay = new Map<string, number>();
  for (const t of tickets) perDay.set(watDay(t.purchased_at), (perDay.get(watDay(t.purchased_at)) ?? 0) + 1);
  const daily: { date: string; tickets: number }[] = [];
  if (tickets.length) {
    const today = watDay(new Date().toISOString());
    const eventDay = String(ev.date).slice(0, 10);
    const end = eventDay < today ? eventDay : today;
    let d = watDay(tickets[0].purchased_at);
    const lastDay = end > d ? end : d;
    const start = new Date(`${lastDay}T00:00:00Z`).getTime() - 89 * 86400_000;
    if (new Date(`${d}T00:00:00Z`).getTime() < start) d = new Date(start).toISOString().slice(0, 10);
    while (d <= lastDay) {
      daily.push({ date: d, tickets: perDay.get(d) ?? 0 });
      d = new Date(new Date(`${d}T00:00:00Z`).getTime() + 86400_000).toISOString().slice(0, 10);
    }
  }

  // Recent orders, grouped by payment reference, newest first. Tier + count + time only.
  const tierName = new Map(tiers.map(t => [t.id, t.name]));
  const orders = new Map<string, { tier: string; tickets: number; at: string }>();
  for (const t of tickets) {
    const key = t.paystack_reference ?? `${t.purchased_at}:${t.tier_id}`;
    const o = orders.get(key);
    if (o) o.tickets++;
    else orders.set(key, { tier: tierName.get(t.tier_id) ?? 'Ticket', tickets: 1, at: t.purchased_at });
  }
  const recent = [...orders.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);

  const status = String(ev.status);
  const state: MonitorSnapshot['event']['state'] =
    status === 'completed' ? 'ended'
    : status === 'cancelled' ? 'cancelled'
    : status === 'under_review' ? 'under_review'
    : status === 'approved' ? (isScheduled(ev.goes_live_at) ? 'scheduled' : 'live')
    : 'not_listed';

  return {
    event: {
      name: ev.event_name, date: String(ev.date).slice(0, 10), time: ev.time ?? '',
      mode: ev.event_mode === 'online' ? 'online' : 'physical',
      venue: ev.event_mode === 'online' ? null : (ev.venue ?? null),
      city: ev.event_mode === 'online' ? null : (ev.city ?? null),
      bannerUrl: ev.banner_url ?? null, state, goesLiveAt: ev.goes_live_at ?? null,
    },
    organizerName: String(org?.name ?? '').trim() || 'The organiser',
    label,
    totals: {
      ticketsSold: tierRows.reduce((s, t) => s + t.sold, 0),
      ticketsAvailable: tierRows.reduce((s, t) => s + t.available, 0),
      // Rounded once over the whole event, exactly like the organiser's event page.
      netRevenue: Math.round(tierRows.reduce((s, t) => s + t.price * t.sold, 0) * (1 - rate)),
      buyers: new Set(tickets.map(t => (t.buyer_email ?? '').toLowerCase()).filter(Boolean)).size,
      checkedIn: tickets.filter(t => t.status === 'used').length,
      validTickets: tickets.length,
      orders: orders.size,
    },
    tiers: tierRows,
    daily,
    recent,
    generatedAt: new Date().toISOString(),
  };
}
