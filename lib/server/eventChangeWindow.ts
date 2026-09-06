import { getServerSupabase } from '@/lib/supabase/server';
import { sendChangeRefundOptOutEmail } from '@/lib/server/email';
import { signTicketLink } from '@/lib/server/ticketLinks';

/**
 * Records one event_changes row for a qualifying venue/date change and emails
 * every ticket purchased before this change (buyers who purchase after it
 * bought the new details, so they're never queried here) a signed, no-login
 * opt-out link good for 48h or until the (new) event start, whichever comes
 * first — an event 20h away shouldn't hand out a window that outlives it.
 *
 * Shared between the organiser's own edit route (first 2 changes, applied
 * immediately) and the admin change-request approval route (3rd+ change,
 * applied only once approved) — one escrow-correct code path either way.
 */
export async function createChangeRefundWindow(
  db: ReturnType<typeof getServerSupabase>,
  event: {
    eventId: string;
    eventSlug: string;
    eventName: string;
    changeType: 'venue' | 'date' | 'venue_and_date';
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    newEventDate: string;
    newEventTime: string;
    location?: { venue: string; address: string; city: string };
  },
) {
  const now = new Date();
  const newEventStartMs = new Date(`${event.newEventDate}T${event.newEventTime}:00+01:00`).getTime();
  const windowMs = Math.min(48 * 60 * 60 * 1000, newEventStartMs - now.getTime());
  if (windowMs <= 0) {
    // The new date/time is already here or past — no sensible refund window
    // to offer. This shouldn't happen for a live, still-selling event, but
    // guards against a nonsensical negative-length window either way.
    return;
  }
  const closesAt = new Date(now.getTime() + windowMs);

  const { data: change, error: changeErr } = await db
    .from('event_changes')
    .insert({
      event_id: event.eventId,
      change_type: event.changeType,
      old_value: event.oldValue,
      new_value: event.newValue,
      changed_at: now.toISOString(),
      refund_window_closes_at: closesAt.toISOString(),
    })
    .select('id')
    .single();

  if (changeErr) throw changeErr;

  const { data: tickets, error: ticketsErr } = await db
    .from('tickets')
    .select('id, buyer_email, buyer_name')
    .eq('event_id', event.eventId)
    .eq('status', 'valid')
    .lt('purchased_at', now.toISOString());

  if (ticketsErr) throw ticketsErr;

  const windowSeconds = windowMs / 1000;

  await Promise.all((tickets ?? []).map(ticket => {
    const token = signTicketLink({ ticketId: ticket.id, purpose: 'refund_opt_out', changeId: change.id }, windowSeconds);
    return sendChangeRefundOptOutEmail({
      to: ticket.buyer_email,
      buyerName: ticket.buyer_name,
      eventName: event.eventName,
      changeType: event.changeType,
      newDate: event.newEventDate,
      newTime: event.newEventTime,
      newVenue: event.location?.venue,
      newAddress: event.location?.address,
      newCity: event.location?.city,
      optOutUrl: `${process.env.NEXT_PUBLIC_APP_URL}/refund-opt-out/${token}`,
      windowClosesAt: closesAt.toISOString(),
      eventUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${event.eventSlug}`,
    }).catch(err => console.error('sendChangeRefundOptOutEmail error', { to: ticket.buyer_email, err }));
  }));
}

/**
 * Re-sends the opt-out link for a ticket's most recent still-open change
 * window — used by the support agent's resend_opt_out_email tool when a
 * buyer says they lost the original email. Returns null if there's no open
 * window for this ticket (the tool should tell the buyer the window has
 * closed rather than silently doing nothing).
 */
export async function resendChangeOptOutEmail(
  db: ReturnType<typeof getServerSupabase>,
  ticketId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: ticket } = await db
    .from('tickets')
    .select('id, event_id, buyer_email, buyer_name')
    .eq('id', ticketId)
    .maybeSingle();
  if (!ticket) return { ok: false, reason: 'Ticket not found' };

  const { data: change } = await db
    .from('event_changes')
    .select('id, event_id, change_type, old_value, new_value, refund_window_closes_at')
    .eq('event_id', ticket.event_id)
    .gt('refund_window_closes_at', new Date().toISOString())
    .order('changed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!change) return { ok: false, reason: 'No open change window for this event' };

  const { data: event } = await db
    .from('events')
    .select('event_name, slug, date, time, venue, address, city')
    .eq('id', ticket.event_id)
    .maybeSingle();
  if (!event) return { ok: false, reason: 'Event not found' };

  const newValue = change.new_value as Record<string, unknown>;
  const windowSeconds = (new Date(change.refund_window_closes_at).getTime() - Date.now()) / 1000;
  const token = signTicketLink({ ticketId: ticket.id, purpose: 'refund_opt_out', changeId: change.id }, windowSeconds);

  await sendChangeRefundOptOutEmail({
    to: ticket.buyer_email,
    buyerName: ticket.buyer_name,
    eventName: event.event_name,
    changeType: change.change_type,
    newDate: (newValue.date as string) ?? event.date,
    newTime: (newValue.time as string) ?? event.time,
    newVenue: (newValue.venue as string) ?? event.venue,
    newAddress: (newValue.address as string) ?? event.address,
    newCity: (newValue.city as string) ?? event.city,
    optOutUrl: `${process.env.NEXT_PUBLIC_APP_URL}/refund-opt-out/${token}`,
    windowClosesAt: change.refund_window_closes_at,
    eventUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${event.slug}`,
  });

  return { ok: true };
}

/** How many venue/date changes an event has already had applied — the organiser's first 2 are free; the rest need admin approval. */
export async function countAppliedEventChanges(db: ReturnType<typeof getServerSupabase>, eventId: string): Promise<number> {
  const { count } = await db.from('event_changes').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
  return count ?? 0;
}

export const FREE_ORGANIZER_CHANGE_LIMIT = 2;
