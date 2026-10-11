// Shared (client + server) shape and helpers for events on the public pages
// — landing and browse. Fetching lives in lib/server/publicEvents.ts.
import type { UrgencyLevel } from '@/lib/ticketUrgency';

export interface PublicTier {
  id: string;
  name: string;
  price: number;
  available: number;
  sold: number;
}

export interface PublicOrganizer {
  id: string;
  name: string;
  handle: string | null;
  verified: boolean;
  avatarUrl: string | null;
  /** Storefront cover image — a last-resort picture for events with no artwork of their own. */
  coverUrl: string | null;
}

export interface PublicEvent {
  id: string;
  slug: string;
  name: string;
  category: string;
  eventMode: 'physical' | 'online';
  /** YYYY-MM-DD, the event's calendar day in Nigeria. */
  date: string;
  time: string;
  /** Null when the organiser hid the exact location. */
  venue: string | null;
  city: string;
  landmark: string | null;
  locationHidden: boolean;
  status: 'approved' | 'completed';
  flyerUrl: string | null;
  headerBannerUrl: string | null;
  accentColor: string | null;
  /** Ventry confirmed the venue booking for this event: the Verified badge. */
  verified: boolean;
  organizer: PublicOrganizer;
  tiers: PublicTier[];
  /** Cheapest price across tiers (0 = a free tier exists); null when no tiers. */
  minPrice: number | null;
  /** Cheapest tier still on sale, for "Early bird, 12 left" style notes. */
  cheapestOnSale: { name: string; price: number; remaining: number } | null;
  totalSold: number;
  totalAvailable: number;
  soldOut: boolean;
  urgency: UrgencyLevel | null;
  /** Completed events only: tickets scanned at the door. 0 when nobody was scanned. */
  checkedIn: number;
  /** Completed events only, and only when real reviews exist. */
  rating: { avg: number; count: number } | null;
}

/**
 * Every picture the organiser has given us for this event, best first, for
 * the given slot. Cards are portrait, so the flyer leads; wide slots lead
 * with the header banner. The organiser's storefront cover and avatar are
 * last resorts so a card is never left blank while any real image exists.
 */
export function eventImages(
  e: Pick<PublicEvent, 'flyerUrl' | 'headerBannerUrl' | 'organizer'>,
  slot: 'portrait' | 'wide' = 'portrait',
): string[] {
  const own = slot === 'wide' ? [e.headerBannerUrl, e.flyerUrl] : [e.flyerUrl, e.headerBannerUrl];
  return [...new Set([...own, e.organizer.coverUrl, e.organizer.avatarUrl].filter((u): u is string => !!u))];
}

const WAT = 'Africa/Lagos';

/** Today's calendar date in Nigeria, YYYY-MM-DD. */
export function todayWAT(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: WAT });
}

/** Parse a YYYY-MM-DD as a noon-UTC Date so it can't slip a day in any zone. */
function dayDate(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T12:00:00Z`);
}

export function addDays(ymd: string, n: number): string {
  const d = dayDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(ymd: string): number {
  return dayDate(ymd).getUTCDay();
}

/** Friday–Sunday of the current week (from today if it's already the weekend). */
export function weekendRange(today: string): [string, string] {
  const dow = weekday(today);
  if (dow === 5 || dow === 6 || dow === 0) {
    const toSunday = dow === 0 ? 0 : 7 - dow;
    return [today, addDays(today, toSunday)];
  }
  return [addDays(today, 5 - dow), addDays(today, 7 - dow)];
}

/** "Fri 20 Nov" */
export function fmtDay(ymd: string): string {
  return dayDate(ymd).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "20 Nov" */
export function fmtShortDay(ymd: string): string {
  return dayDate(ymd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "Friday 20 November" */
export function fmtLongDay(ymd: string): string {
  return dayDate(ymd).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** "Fri 20 Nov 2026" */
export function fmtDayYear(ymd: string): string {
  return dayDate(ymd).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function naira(n: number): string {
  return '₦' + Math.round(n).toLocaleString('en-NG');
}

/** One-line location that never reveals a hidden address. */
export function locationLine(e: Pick<PublicEvent, 'eventMode' | 'locationHidden' | 'venue' | 'city' | 'landmark'>): string {
  if (e.eventMode === 'online') return 'Online · link in your ticket';
  if (e.locationHidden || !e.venue) return e.landmark ? `Near ${e.landmark}, ${e.city}` : e.city;
  return `${e.venue}, ${e.city}`;
}

/**
 * Cities are free text typed by organisers ("Enugu ", "Anambra state"), so
 * group them on a cleaned form: trimmed, single-spaced, title-cased, with a
 * trailing "State" dropped.
 */
export function normalizeCity(raw: string | null | undefined): string {
  const cleaned = (raw ?? '').trim().replace(/\s+/g, ' ').replace(/\s+state$/i, '');
  return cleaned.replace(/\b([a-z])/g, c => c.toUpperCase());
}

export function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

/** "Sold out" / "65 checked in" / "147 tickets" — the strongest real outcome for a past event. */
export function outcomeLabel(e: PublicEvent): string | null {
  if (e.soldOut) return 'Sold out';
  if (e.checkedIn > 0) return `${e.checkedIn.toLocaleString('en-NG')} checked in`;
  if (e.totalSold > 0) return `${e.totalSold.toLocaleString('en-NG')} tickets`;
  return null;
}

export function priceLabel(e: PublicEvent): { label: string; value: string; free: boolean } | null {
  if (e.minPrice == null) return null;
  if (e.minPrice === 0) {
    const allFree = e.tiers.every(t => t.price === 0);
    return { label: allFree ? 'Entry' : 'From', value: 'Free', free: true };
  }
  return { label: 'From', value: naira(e.minPrice), free: false };
}
