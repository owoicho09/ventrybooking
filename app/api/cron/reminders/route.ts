import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendReminderEmail } from '@/lib/server/email';

type ReminderType = '1_week' | '1_day' | '3_hours';

// Widened windows for Vercel Hobby daily cron (runs once at 07:00 UTC = 08:00 WAT).
// '3_hours' fires as a "today" morning reminder for events happening within 18h.
const WINDOWS: { type: ReminderType; minHours: number; maxHours: number }[] = [
  { type: '1_week',  minHours: 156, maxHours: 204 },
  { type: '1_day',   minHours: 18,  maxHours: 48 },
  { type: '3_hours', minHours: 0,   maxHours: 18 },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db  = getServerSupabase();
    const now = new Date();

    // Look ahead 8 days to cover the 1-week reminder window
    const windowEnd = new Date(now.getTime() + 8.5 * 24 * 60 * 60 * 1000);
    const todayStr  = now.toISOString().split('T')[0];
    const endStr    = windowEnd.toISOString().split('T')[0];

    const { data: events } = await db
      .from('events')
      .select('id, event_name, date, time, venue, city, address')
      .eq('status', 'approved')
      .gte('date', todayStr)
      .lte('date', endStr);

    if (!events || events.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    let totalSent = 0;

    for (const event of events) {
      // Parse event start time in WAT (UTC+1)
      const eventStartMs = new Date(`${event.date}T${event.time}:00+01:00`).getTime();
      const diffHours    = (eventStartMs - now.getTime()) / (1000 * 60 * 60);

      const applicableWindows = WINDOWS.filter(
        w => diffHours >= w.minHours && diffHours < w.maxHours,
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
              eventVenue:   event.venue,
              eventCity:    event.city,
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
