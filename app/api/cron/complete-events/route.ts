import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendReviewRequestEmail } from '@/lib/server/email';
import { signTicketLink } from '@/lib/server/ticketLinks';

// A grace period after the event's start time before it's considered
// "over" — long enough that a typical event (especially the late-running
// parties/concerts this platform is built around) has actually finished,
// so review requests don't land in inboxes while people are still there.
const COMPLETION_GRACE_HOURS = 6;
const REVIEW_LINK_EXPIRY_DAYS = 14;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServerSupabase();
    const now = new Date();

    // Look back far enough to catch anything the daily cron might have
    // missed, but not so far it re-scans the entire event history each run.
    const lookbackStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const lookbackStr = lookbackStart.toISOString().split('T')[0];

    const { data: events } = await db
      .from('events')
      .select('id, slug, event_name, date, time, organizer:users!events_organizer_id_fkey(name)')
      .eq('status', 'approved')
      .gte('date', lookbackStr)
      .lte('date', todayStr);

    if (!events || events.length === 0) {
      return NextResponse.json({ success: true, completed: 0, reviewEmailsSent: 0 });
    }

    let completedCount = 0;
    let reviewEmailsSent = 0;

    for (const event of events) {
      const eventStartMs = new Date(`${event.date}T${event.time}:00+01:00`).getTime();
      const isOver = now.getTime() >= eventStartMs + COMPLETION_GRACE_HOURS * 60 * 60 * 1000;
      if (!isOver) continue;

      const { error: updateErr } = await db.from('events').update({ status: 'completed' }).eq('id', event.id);
      if (updateErr) {
        console.error('complete-events: failed to mark event completed', event.id, updateErr);
        continue;
      }
      completedCount++;

      const organizerRaw = event.organizer as { name: string }[] | { name: string } | null;
      const organizerName = (Array.isArray(organizerRaw) ? organizerRaw[0] : organizerRaw)?.name ?? null;

      // Checked-in tickets only — the scan endpoint flips a ticket to 'used'
      // on successful check-in, so that status *is* "attended."
      const { data: tickets } = await db
        .from('tickets')
        .select('id, buyer_email, buyer_name')
        .eq('event_id', event.id)
        .eq('status', 'used')
        .is('review_requested_at', null);

      for (const ticket of tickets ?? []) {
        try {
          const token = signTicketLink({ ticketId: ticket.id, purpose: 'review' }, REVIEW_LINK_EXPIRY_DAYS * 24 * 60 * 60);
          await sendReviewRequestEmail({
            to: ticket.buyer_email,
            buyerName: ticket.buyer_name,
            eventName: event.event_name,
            reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/review/${token}`,
            organizerName,
          });
          await db.from('tickets').update({ review_requested_at: new Date().toISOString() }).eq('id', ticket.id);
          reviewEmailsSent++;
        } catch (err) {
          console.error('complete-events: review request email failed', ticket.id, err);
        }
      }
    }

    return NextResponse.json({ success: true, completed: completedCount, reviewEmailsSent });
  } catch (err) {
    console.error('GET /api/cron/complete-events error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
