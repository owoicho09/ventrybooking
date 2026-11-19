// Venue to be announced (061). An event can be listed with only its city and
// LGA; the venue must be added no later than 7 days before the event starts.
// The organiser is reminded 10 and 8 days out; at 7 days ticket sales pause
// and an admin decides whether to cancel or allow more time. When the venue
// is added, every ticket holder is emailed it.

import { eventStart } from '@/lib/addressReveal';

/** Stored in events.venue until the real venue is added, so every page,
 *  ticket and email reads sensibly without special-casing. */
export const VENUE_TBA_LABEL = 'Venue to be announced';
export const VENUE_DEADLINE_DAYS = 7;
export const VENUE_REMINDER_DAYS = [10, 8] as const;
const DAY = 24 * 60 * 60 * 1000;

/** The latest moment the venue can be added. */
export function venueDeadline(date: string, time: string): Date {
  return new Date(eventStart(date, time).getTime() - VENUE_DEADLINE_DAYS * DAY);
}

/** Why an event can't be listed without a venue right now; null when it can. */
export function venueTbaProblem(date: string, time: string, now: Date = new Date()): string | null {
  if (venueDeadline(date, time).getTime() <= now.getTime()) {
    return `Your event is less than ${VENUE_DEADLINE_DAYS} days away, so the venue has to be added now.`;
  }
  return null;
}

/** "Fri 11 Dec" in Nigeria time. */
export function fmtVenueDeadline(date: string, time: string): string {
  return venueDeadline(date, time).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short' });
}
