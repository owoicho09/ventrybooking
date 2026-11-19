import { getServerSupabase } from '@/lib/supabase/server';
import { eventStart } from '@/lib/addressReveal';
import { notify } from '@/lib/server/notify';
import { sendOrganizerNoticeEmail } from '@/lib/server/email';
import { VENUE_DEADLINE_DAYS, fmtVenueDeadline } from '@/lib/venueTba';

/**
 * Venue-to-be-announced deadlines (061), run from the daily reminders cron.
 *
 *   10 and 8 days before the event  remind the organiser (once each)
 *   7 days before, still no venue   pause ticket sales, email the organiser,
 *                                   alert admins, who cancel (normal refund
 *                                   process) or allow more time
 *
 * Every step is claimed by stamping its column first, so an overlapping or
 * repeated run never emails twice. `dryRun` reports without changing anything.
 */

const DAY = 24 * 60 * 60 * 1000;

type Org = { id: string; name: string; email: string };
type Row = {
  id: string; event_name: string; date: string; time: string; status: string; city: string | null; lga: string | null;
  venue_reminder_10_at: string | null; venue_reminder_8_at: string | null;
  venue_deadline_alerted_at: string | null; venue_deadline_extended_at: string | null; sales_paused_reason: string | null;
  organizer: Org | Org[] | null;
};

export async function runVenueDeadlines({ dryRun = false, now = new Date() }: { dryRun?: boolean; now?: Date } = {}) {
  const db = getServerSupabase();
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + 11 * DAY).toISOString().slice(0, 10);

  const { data, error } = await db
    .from('events')
    .select(`id, event_name, date, time, status, city, lga, venue_reminder_10_at, venue_reminder_8_at,
      venue_deadline_alerted_at, venue_deadline_extended_at, sales_paused_reason,
      organizer:users!events_organizer_id_fkey(id, name, email)`)
    .eq('venue_tba', true)
    .in('status', ['approved', 'under_review'])
    .gte('date', today)
    .lte('date', horizon)
    .limit(200);
  if (error) throw error;

  const done: { event: string; step: string }[] = [];

  for (const ev of (data ?? []) as unknown as Row[]) {
    const org = Array.isArray(ev.organizer) ? ev.organizer[0] : ev.organizer;
    const msLeft = eventStart(String(ev.date), ev.time).getTime() - now.getTime();
    const deadline = fmtVenueDeadline(String(ev.date), ev.time);
    const area = [ev.lga, ev.city].filter(Boolean).join(', ');
    const link = `/organizer/events/${ev.id}`;

    // Claim a step by stamping it; only the run that flips it from null acts.
    const claim = async (col: string, extra: Record<string, unknown> = {}) => {
      if (dryRun) return true;
      const { data: got } = await db.from('events')
        .update({ [col]: now.toISOString(), ...extra })
        .eq('id', ev.id).is(col, null).eq('venue_tba', true)
        .select('id');
      return !!got?.length;
    };

    if (msLeft <= VENUE_DEADLINE_DAYS * DAY) {
      if (ev.venue_deadline_alerted_at || ev.venue_deadline_extended_at) continue;
      // Only a live event has sales to pause.
      const pause = ev.status === 'approved' ? { sales_paused_reason: 'venue_missing' } : {};
      if (!(await claim('venue_deadline_alerted_at', pause))) continue;
      done.push({ event: ev.event_name, step: 'deadline' });
      if (dryRun) continue;
      await notify({ type: 'admin' }, {
        notifType: 'event',
        title: `Venue missing: ${ev.event_name}`,
        body: `"${ev.event_name}" (${area}) still has no venue ${VENUE_DEADLINE_DAYS} days before the event. `
          + (ev.status === 'approved' ? 'Ticket sales are paused. ' : '')
          + 'Cancel it (normal refunds) or allow more time from the admin events page.',
        link: '/admin/events',
      }, { emailChannel: 'immediate' }).catch(err => console.error('venue deadline admin alert failed', err));
      if (org?.email) {
        await sendOrganizerNoticeEmail({
          to: org.email,
          organizerName: org.name,
          subject: `Action needed: add the venue for "${ev.event_name}"`,
          heading: 'Your venue is overdue',
          lines: [
            `"${ev.event_name}" still has no venue, and it had to be added at least ${VENUE_DEADLINE_DAYS} days before the event.`,
            ev.status === 'approved' ? 'Ticket sales are paused until you add it.' : 'Add it before your event is approved.',
            'Ventry may cancel the event if the venue isn’t confirmed, in which case buyers are refunded through the normal refund process. Add it now to avoid that.',
          ],
          ctaLabel: 'Add the venue',
          ctaPath: link,
          purpose: 'venue_deadline_missed',
        }).catch(err => console.error('venue deadline organiser email failed', err));
      }
      continue;
    }

    for (const days of [10, 8] as const) {
      const col = days === 10 ? 'venue_reminder_10_at' : 'venue_reminder_8_at';
      if (msLeft > days * DAY || ev[col]) continue;
      // Already inside the 8-day mark: the 10-day reminder would be redundant.
      if (days === 10 && msLeft <= 8 * DAY) { await claim(col); continue; }
      if (!(await claim(col))) continue;
      done.push({ event: ev.event_name, step: `reminder_${days}` });
      if (dryRun || !org?.email) continue;
      const daysLeft = Math.max(1, Math.ceil((msLeft - VENUE_DEADLINE_DAYS * DAY) / DAY));
      await sendOrganizerNoticeEmail({
        to: org.email,
        organizerName: org.name,
        subject: `Reminder: add the venue for "${ev.event_name}" by ${deadline}`,
        heading: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left to add your venue`,
        lines: [
          `Buyers can currently see only ${area || 'the city'} for "${ev.event_name}".`,
          `The venue has to be added by ${deadline} (${VENUE_DEADLINE_DAYS} days before the event). After that, ticket sales pause and the event may be cancelled.`,
          'As soon as you add it, everyone with a ticket is emailed the venue.',
        ],
        ctaLabel: 'Add the venue',
        ctaPath: link,
        purpose: `venue_reminder_${days}`,
      }).catch(err => console.error('venue reminder email failed', err));
      notify({ type: 'organizer', id: org.id }, {
        notifType: 'event',
        title: `Add your venue by ${deadline}`,
        body: `"${ev.event_name}" needs its venue at least ${VENUE_DEADLINE_DAYS} days before the event.`,
        link,
      }).catch(() => {});
    }
  }

  return { checked: data?.length ?? 0, done };
}
