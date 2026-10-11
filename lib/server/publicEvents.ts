import { getServerSupabase } from '@/lib/supabase/server';
import { ticketUrgency } from '@/lib/ticketUrgency';
import { normalizeCity, todayWAT, type PublicEvent, type PublicTier } from '@/lib/publicEvents';

// Every figure on the public pages comes from here, straight out of the
// database. Nothing is rounded up, estimated or defaulted: when a number
// can't be computed, the field is left null/0 and the page omits it.

const EVENT_SELECT = `
  id, slug, event_name, category, date, time, event_mode, venue, city, landmark, location_hidden,
  status, total_sold, banner_url, header_banner_url, accent_color,
  organizer:users!events_organizer_id_fkey(id, name, verified, handle, avatar_url, cover_image_url),
  tiers:ticket_tiers(id, name, price, available, sold)
`;

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shape(row: any): PublicEvent {
  const tiers: PublicTier[] = (Array.isArray(row.tiers) ? row.tiers : []).map((t: PublicTier) => ({
    id: t.id, name: t.name, price: Number(t.price), available: t.available, sold: t.sold,
  }));
  const onSale = tiers.filter(t => t.available - t.sold > 0).sort((a, b) => a.price - b.price);
  const totalAvailable = tiers.reduce((s, t) => s + t.available, 0);
  const totalSold = tiers.reduce((s, t) => s + t.sold, 0);
  const soldOut = tiers.length > 0 && onSale.length === 0;
  const prices = (onSale.length ? onSale : tiers).map(t => t.price);
  const locationHidden = row.location_hidden ?? false;
  const org = one(row.organizer) as { id: string; name: string; verified: boolean; handle: string | null; avatar_url: string | null; cover_image_url: string | null } | null;
  const status = row.status === 'completed' ? 'completed' : 'approved';

  return {
    id: row.id,
    slug: row.slug || row.id,
    name: String(row.event_name ?? '').trim(),
    category: row.category ?? 'Other',
    eventMode: row.event_mode === 'online' ? 'online' : 'physical',
    date: String(row.date).slice(0, 10),
    time: row.time ?? '',
    venue: locationHidden ? null : (row.venue ?? null),
    city: normalizeCity(row.city),
    landmark: row.landmark ?? null,
    locationHidden,
    status,
    flyerUrl: row.banner_url ?? null,
    headerBannerUrl: row.header_banner_url ?? null,
    accentColor: row.accent_color ?? null,
    organizer: {
      id: org?.id ?? '',
      name: String(org?.name ?? '').trim(),
      handle: org?.handle ?? null,
      verified: !!org?.verified,
      avatarUrl: org?.avatar_url ?? null,
      coverUrl: org?.cover_image_url ?? null,
    },
    tiers,
    minPrice: prices.length ? Math.min(...prices) : null,
    cheapestOnSale: onSale[0] ? { name: onSale[0].name, price: onSale[0].price, remaining: onSale[0].available - onSale[0].sold } : null,
    totalSold,
    totalAvailable,
    soldOut,
    urgency: status === 'completed' ? null : (ticketUrgency(totalAvailable, totalSold) ?? null),
    checkedIn: 0,
    rating: null,
  };
}

/**
 * Every published event: on sale (approved) and finished (completed).
 * Completed events get their real door count and review rating attached.
 */
export async function getPublicEvents(): Promise<PublicEvent[]> {
  const db = getServerSupabase();
  const { data, error } = await db
    .from('events')
    .select(EVENT_SELECT)
    .in('status', ['approved', 'completed'])
    .eq('tiers.hidden', false)
    .order('date', { ascending: true });
  if (error) {
    console.error('getPublicEvents', error);
    return [];
  }
  const events = (data ?? []).map(shape);

  const completed = events.filter(e => e.status === 'completed');
  if (completed.length) {
    const ids = completed.map(e => e.id);
    const [doorCounts, reviews] = await Promise.all([
      Promise.all(ids.map(async id => {
        const { count } = await db
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', id)
          .eq('status', 'used');
        return [id, count ?? 0] as const;
      })),
      db.from('event_reviews').select('event_id, rating').in('event_id', ids).eq('hidden', false),
    ]);
    const doors = new Map(doorCounts);
    const ratings = new Map<string, { sum: number; count: number }>();
    for (const r of (reviews.data ?? []) as { event_id: string; rating: number }[]) {
      const cur = ratings.get(r.event_id) ?? { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      ratings.set(r.event_id, cur);
    }
    for (const e of completed) {
      e.checkedIn = doors.get(e.id) ?? 0;
      const r = ratings.get(e.id);
      if (r && r.count > 0) e.rating = { avg: Math.round((r.sum / r.count) * 10) / 10, count: r.count };
    }
  }
  return events;
}

export interface PlatformFigures {
  /** Sum of net amounts actually paid out to organisers. */
  settledTotal: number;
  /** Paid/claimed tickets issued since the 1st of this month (WAT). */
  ticketsThisMonth: number;
}

export async function getPlatformFigures(): Promise<PlatformFigures> {
  const db = getServerSupabase();
  const monthStart = `${todayWAT().slice(0, 7)}-01T00:00:00+01:00`;
  const [settled, month] = await Promise.all([
    db.from('settlements').select('net').eq('status', 'successful'),
    db.from('tickets').select('id', { count: 'exact', head: true }).in('status', ['valid', 'used']).gte('purchased_at', monthStart),
  ]);
  const settledTotal = (settled.data ?? []).reduce((s: number, r: { net: number | string }) => s + Number(r.net || 0), 0);
  return { settledTotal: Math.round(settledTotal), ticketsThisMonth: month.count ?? 0 };
}

export interface CityCount { city: string; count: number; upcoming: number }

/** Cities ranked by how many events have been published there. */
export function cityCounts(events: PublicEvent[]): CityCount[] {
  const map = new Map<string, CityCount>();
  for (const e of events) {
    if (e.eventMode === 'online' || !e.city) continue;
    const cur = map.get(e.city) ?? { city: e.city, count: 0, upcoming: 0 };
    cur.count += 1;
    if (e.status === 'approved') cur.upcoming += 1;
    map.set(e.city, cur);
  }
  return [...map.values()].sort((a, b) => b.upcoming - a.upcoming || b.count - a.count || a.city.localeCompare(b.city));
}

export interface PublicOrganizerSummary {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
  city: string | null;
  events: number;
  accent: string | null;
}

/** Organisers with a public storefront and at least one published event. */
export function organizerSummaries(events: PublicEvent[]): PublicOrganizerSummary[] {
  const map = new Map<string, PublicOrganizerSummary & { cities: Map<string, number>; latest: string }>();
  for (const e of events) {
    const o = e.organizer;
    if (!o.handle || !o.name) continue;
    const cur = map.get(o.id) ?? { id: o.id, name: o.name, handle: o.handle, avatarUrl: o.avatarUrl, verified: o.verified, city: null, events: 0, accent: null, cities: new Map(), latest: '' };
    cur.events += 1;
    if (e.city) cur.cities.set(e.city, (cur.cities.get(e.city) ?? 0) + 1);
    if (e.date > cur.latest) { cur.latest = e.date; cur.accent = e.accentColor ?? cur.accent; }
    map.set(o.id, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.latest.localeCompare(a.latest))
    .map(({ cities, ...rest }) => ({
      id: rest.id, name: rest.name, handle: rest.handle, avatarUrl: rest.avatarUrl,
      verified: rest.verified, events: rest.events, accent: rest.accent,
      city: [...cities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }));
}
