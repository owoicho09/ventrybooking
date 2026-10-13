// Scheduled go-live: an organiser lists an event now and picks when it goes
// on sale. Until goes_live_at passes, the event is hidden from the public
// (listings, its page, the sitemap) and checkout refuses it. Shared by the
// APIs, the organiser forms and the go-live cron.

import { eventStart } from '@/lib/addressReveal';

/** Is the event still waiting for its scheduled go-live time? */
export function isScheduled(goesLiveAt: string | null | undefined, now: Date = new Date()): boolean {
  return !!goesLiveAt && new Date(goesLiveAt).getTime() > now.getTime();
}

/** Drop events that haven't reached their go-live time yet. */
export function onlyLive<T extends { goes_live_at?: string | null }>(rows: T[], now: Date = new Date()): T[] {
  return rows.filter(r => !isScheduled(r.goes_live_at, now));
}

/** Validation for a chosen go-live time; null when it's acceptable. */
export function goLiveProblem(goesLiveAt: string | null | undefined, date: string, time: string): string | null {
  if (!goesLiveAt) return null;
  const at = new Date(goesLiveAt);
  if (Number.isNaN(at.getTime())) return 'That go-live time isn’t valid';
  if (at.getTime() >= eventStart(date, time).getTime()) return 'Your event has to go live before it starts';
  return null;
}

/** "Fri 17 Oct, 12:00 pm" in Nigeria time. */
export function fmtGoLive(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

/** ISO instant -> value for a datetime-local input, in Nigeria time (UTC+1, no DST). */
export function toLagosInput(iso: string | null | undefined): string {
  return iso ? new Date(new Date(iso).getTime() + 60 * 60 * 1000).toISOString().slice(0, 16) : '';
}

/** datetime-local value (Nigeria time) -> ISO instant. */
export function fromLagosInput(v: string): string | null {
  return v ? new Date(`${v}:00+01:00`).toISOString() : null;
}
