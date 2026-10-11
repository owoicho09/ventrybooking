// Hidden addresses (Organiser Terms 4.9, Refund Policy §10): the date, city
// and local government area are always shown; only the street address is
// held back, until a reveal time the organiser sets — never later than 24
// hours before doors. Shared by the APIs (redaction), forms (validation) and
// the reveal job.

const HOUR = 60 * 60 * 1000;

/** The event's start as an instant. Event date/time are entered in Lagos time (UTC+1, no DST). */
export function eventStart(date: string, time: string | null | undefined): Date {
  const t = /^\d{1,2}:\d{2}/.test(time ?? '') ? (time as string).slice(0, 5).padStart(5, '0') : '00:00';
  return new Date(`${String(date).slice(0, 10)}T${t}:00+01:00`);
}

/** Latest allowed reveal: 24 hours before doors. */
export function latestReveal(date: string, time: string | null | undefined): Date {
  return new Date(eventStart(date, time).getTime() - 24 * HOUR);
}

/** Validation for a chosen reveal time; null when it's acceptable. */
export function revealTimeProblem(revealAt: string | null | undefined, date: string, time: string): string | null {
  if (!revealAt) return 'Choose when the address is revealed to ticket holders';
  const at = new Date(revealAt);
  if (Number.isNaN(at.getTime())) return 'That reveal time isn’t valid';
  if (at.getTime() > latestReveal(date, time).getTime()) return 'The address must be revealed at least 24 hours before the event starts';
  return null;
}

/**
 * Is the street address hidden from the public right now? A hidden address
 * becomes visible on its own once the reveal time passes; an event without a
 * reveal time (listed before reveal times existed) falls back to 24 hours
 * before doors, the latest the policy allows.
 */
export function addressHiddenNow(
  e: { location_hidden?: boolean | null; address_reveal_at?: string | null; date: string; time?: string | null },
  now: Date = new Date(),
): boolean {
  if (!e.location_hidden) return false;
  const at = e.address_reveal_at ? new Date(e.address_reveal_at) : latestReveal(e.date, e.time);
  return now.getTime() < at.getTime();
}
