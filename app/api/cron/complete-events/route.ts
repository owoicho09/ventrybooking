import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendReviewRequestEmail } from '@/lib/server/email';
import { signTicketLink } from '@/lib/server/ticketLinks';

// Sequential sends of a few hundred emails need more than the platform's
// default function time.
export const maxDuration = 60;

// A grace period after the event's start time before it's considered
// "over" — long enough that a typical event (especially the late-running
// parties/concerts this platform is built around) has actually finished,
// so review requests don't land in inboxes while people are still there.
const COMPLETION_GRACE_HOURS = 6;
const REVIEW_LINK_EXPIRY_DAYS = 14;

// An event stays in scope for this many days after its date. That is what
// makes a failed or capped send retry on the next daily run — completion and
// emailing are separate steps, so an event flipping to 'completed' no longer
// means its emails are done. Deliberately short: it is not a backfill for
// events that finished long ago.
const REVIEW_EMAIL_WINDOW_DAYS = 3;

// Resend allows ~2 requests/second by default, so sends are paced to at most
// one per SEND_SPACING_MS (measured send-to-send, so slow sends aren't padded
// further). One run also has to finish inside maxDuration, so it stops
// starting new sends once TIME_BUDGET_MS has elapsed, leaving headroom for the
// in-flight send and the final response. Whatever is left goes out on the next
// daily run (within the window above). The count cap is a second backstop.
const SEND_SPACING_MS = 550;
const TIME_BUDGET_MS = 40_000;
const MAX_REVIEW_EMAILS_PER_RUN = 80;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const runStartedAt = Date.now();
    const db = getServerSupabase();
    const now = new Date();

    const windowStart = new Date(now.getTime() - REVIEW_EMAIL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const windowStartStr = windowStart.toISOString().split('T')[0];

    // Both statuses: approved events are candidates for completion, and
    // already-completed ones may still have review emails outstanding.
    const { data: events } = await db
      .from('events')
      .select('id, slug, event_name, date, time, status, organizer:users!events_organizer_id_fkey(name)')
      .in('status', ['approved', 'completed'])
      .gte('date', windowStartStr)
      .lte('date', todayStr)
      .order('date', { ascending: true });

    if (!events || events.length === 0) {
      return NextResponse.json({ success: true, completed: 0, reviewEmailsSent: 0, reviewEmailsRemaining: 0 });
    }

    let completedCount = 0;
    let reviewEmailsSent = 0;
    let reviewEmailsRemaining = 0;

    for (const event of events) {
      const eventStartMs = new Date(`${event.date}T${event.time}:00+01:00`).getTime();
      const isOver = now.getTime() >= eventStartMs + COMPLETION_GRACE_HOURS * 60 * 60 * 1000;
      if (!isOver) continue;

      if (event.status === 'approved') {
        const { error: updateErr } = await db.from('events').update({ status: 'completed' }).eq('id', event.id);
        if (updateErr) {
          console.error('complete-events: failed to mark event completed', event.id, updateErr);
          continue;
        }
        completedCount++;
      }

      const organizerRaw = event.organizer as { name: string }[] | { name: string } | null;
      const organizerName = (Array.isArray(organizerRaw) ? organizerRaw[0] : organizerRaw)?.name ?? null;

      // Everyone who bought a ticket, not only people who were scanned at the
      // door — attendance isn't required to rate (matches the on-page rating
      // form). Refunded tickets are excluded.
      const tickets: { id: string; buyer_email: string; buyer_name: string | null; review_requested_at: string | null }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error: pageErr } = await db
          .from('tickets')
          .select('id, buyer_email, buyer_name, review_requested_at')
          .eq('event_id', event.id)
          .in('status', ['valid', 'used'])
          .order('purchased_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + 999);
        if (pageErr) {
          console.error('complete-events: ticket fetch failed', event.id, pageErr);
          break;
        }
        tickets.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }
      if (tickets.length === 0) continue;

      const { data: existingReviews } = await db
        .from('event_reviews')
        .select('ticket_id')
        .eq('event_id', event.id);
      const reviewedTicketIds = new Set((existingReviews ?? []).map(r => r.ticket_id).filter(Boolean));

      // One email per person per event — grouped by email, not one per ticket.
      // The link hangs off their earliest ticket. Skipped if any of their
      // tickets was already emailed or already carries a review.
      const byEmail = new Map<string, typeof tickets>();
      for (const t of tickets) {
        const key = t.buyer_email.trim().toLowerCase();
        const group = byEmail.get(key);
        if (group) group.push(t);
        else byEmail.set(key, [t]);
      }

      const pending = [...byEmail.entries()].filter(([, group]) =>
        group.every(t => !t.review_requested_at) && group.every(t => !reviewedTicketIds.has(t.id)),
      );

      for (const [email, group] of pending) {
        if (reviewEmailsSent >= MAX_REVIEW_EMAILS_PER_RUN || Date.now() - runStartedAt > TIME_BUDGET_MS) {
          reviewEmailsRemaining++;
          continue;
        }
        const anchor = group[0];
        const sendStartedAt = Date.now();
        try {
          const token = signTicketLink({ ticketId: anchor.id, purpose: 'review' }, REVIEW_LINK_EXPIRY_DAYS * 24 * 60 * 60);
          await sendReviewRequestEmail({
            to: email,
            buyerName: anchor.buyer_name ?? '',
            eventName: event.event_name,
            reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/review/${token}`,
            organizerName,
          });
          await db
            .from('tickets')
            .update({ review_requested_at: new Date().toISOString() })
            .in('id', group.map(t => t.id));
          reviewEmailsSent++;
        } catch (err) {
          // Left unmarked, so tomorrow's run picks it up again.
          console.error('complete-events: review request email failed', anchor.id, err);
        }
        await sleep(Math.max(0, SEND_SPACING_MS - (Date.now() - sendStartedAt)));
      }
    }

    return NextResponse.json({ success: true, completed: completedCount, reviewEmailsSent, reviewEmailsRemaining });
  } catch (err) {
    console.error('GET /api/cron/complete-events error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
