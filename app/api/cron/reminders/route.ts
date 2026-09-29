import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendReminderEmail } from '@/lib/server/email';

type ReminderType = '1_week' | '1_day' | '3_hours';

// The cron runs once a day (08:00 WAT), so reminders are picked by calendar-day
// difference in WAT, not hours-until-start: an hours window wide enough to survive
// a daily run also spans two calendar days, which sent "is tomorrow" two days early
// for an early-morning event. '3_hours' is the "today" morning reminder.
const WINDOWS: { type: ReminderType; minDays: number; maxDays: number }[] = [
  { type: '1_week',  minDays: 6, maxDays: 7 },
  { type: '1_day',   minDays: 1, maxDays: 1 },
  { type: '3_hours', minDays: 0, maxDays: 0 },
];

const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS        = 24 * 60 * 60 * 1000;

// Calendar date (YYYY-MM-DD) in WAT for a given instant.
function watDateStr(d: Date): string {
  return new Date(d.getTime() + WAT_OFFSET_MS).toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db  = getServerSupabase();
    const now = new Date();

    // Look ahead 7 WAT calendar days to cover the 1-week reminder window
    const todayStr = watDateStr(now);
    const endStr   = new Date(Date.parse(todayStr) + 7 * DAY_MS).toISOString().split('T')[0];

    const { data: events } = await db
      .from('events')
      .select('id, event_name, date, time, event_mode, venue, city, address, meeting_link, meeting_passcode')
      .eq('status', 'approved')
      .gte('date', todayStr)
      .lte('date', endStr);

    if (!events || events.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    let totalSent = 0;

    for (const event of events) {
      const daysUntil = Math.round((Date.parse(event.date) - Date.parse(todayStr)) / DAY_MS);

      // Don't send a "today" reminder for an event that has already started
      const eventStartMs = new Date(`${event.date}T${event.time}:00+01:00`).getTime();
      if (daysUntil === 0 && !(eventStartMs > now.getTime())) continue;

      // At most one reminder per run (the 1-week and 1-day ranges never overlap)
      const applicableWindows = WINDOWS.filter(
        w => daysUntil >= w.minDays && daysUntil <= w.maxDays,
      );
      if (applicableWindows.length === 0) continue;

      // Fetch all valid (unsent-refunded) tickets for this event
      const { data: tickets } = await db
        .from('tickets')
        .select('id, buyer_email, buyer_name')
        .eq('event_id', event.id)
        .eq('status', 'valid');

      if (!tickets || tickets.length === 0) continue;

      for (const window of applicableWindows) {
        // Find tickets that have NOT yet been sent this reminder type
        const ticketIds = tickets.map(t => t.id);

        const { data: alreadySent } = await db
          .from('reminder_logs')
          .select('ticket_id')
          .eq('reminder_type', window.type)
          .in('ticket_id', ticketIds);

        const sentSet = new Set((alreadySent ?? []).map(r => r.ticket_id));
        const pending = tickets.filter(t => !sentSet.has(t.id));

        for (const ticket of pending) {
          try {
            await sendReminderEmail({
              to:           ticket.buyer_email,
              buyerName:    ticket.buyer_name,
              ticketId:     ticket.id,
              eventName:    event.event_name,
              eventDate:    new Date(event.date).toLocaleDateString('en-NG', {
                              day: 'numeric', month: 'long', year: 'numeric',
                            }),
              eventTime:    event.time,
              eventMode:    event.event_mode,
              eventVenue:   event.venue,
              eventCity:    event.city,
              meetingLink:     event.meeting_link,
              meetingPasscode: event.meeting_passcode,
              reminderType: window.type,
            });

            await db.from('reminder_logs').insert({
              ticket_id:     ticket.id,
              event_id:      event.id,
              reminder_type: window.type,
              sent_at:       new Date().toISOString(),
            });

            totalSent++;
          } catch (err) {
            console.error(`reminders: failed to send ${window.type} reminder to ${ticket.buyer_email}`, err);
          }
        }
      }
    }

    return NextResponse.json({ success: true, sent: totalSent });
  } catch (err) {
    console.error('GET /api/cron/reminders error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
