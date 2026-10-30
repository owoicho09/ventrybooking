import { NextRequest, NextResponse } from 'next/server';
import { goLiveProblem, isScheduled } from '@/lib/goLive';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendLocationUpdatedEmail, sendMeetingLinkUpdatedEmail } from '@/lib/server/email';
import { isValidAccentColor } from '@/lib/accentColors';
import { normalizeLineup, type LineupAct } from '@/lib/server/lineup';
import { normalizeEmailDomains } from '@/lib/server/domainRestriction';
import { parseRefundPolicy, type RefundPolicyAnswers } from '@/lib/refundPolicy';
import { revealTimeProblem, eventStart, addressHiddenNow } from '@/lib/addressReveal';
import { handleEventChange } from '@/lib/server/refundCases';
import { PLATFORM_FEE_RATE } from '@/lib/fees';

// A date/venue change emails ticket holders before responding.
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data: event, error } = await db
      .from('events')
      .select(`
        id, slug, event_name, category, description, date, time, event_mode, venue, address, city, landmark,
        location_hidden, meeting_link, meeting_passcode, status, total_sold, banner_color, banner_url, header_banner_url, accent_color, lineup, allowed_email_domains, organizer_id, created_at, refund_policy, refund_policy_set_at, verified, venue_proof_url, venue_contact_name, venue_contact_phone, lga, address_reveal_at, goes_live_at,
        tiers:ticket_tiers(id, name, price, available, sold)
      `)
      .eq('id', id)
      .eq('organizer_id', user.sub)
      .maybeSingle();

    if (error) throw error;
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data: org } = await db.from('users').select('platform_fee_rate').eq('id', user.sub).maybeSingle();

    return NextResponse.json({ success: true, data: event, platformFeeRate: org?.platform_fee_rate ?? PLATFORM_FEE_RATE });
  } catch (err) {
    console.error('GET /api/organizer/events/[id] error', err);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('id, slug, organizer_id, status, event_name, date, time, event_mode, venue, address, city, landmark, location_hidden, meeting_link, meeting_passcode, refund_policy, lga, address_reveal_at, postponement_count, original_date, goes_live_at')
      .eq('id', id)
      .single();

    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const body = await req.json();

    // Events go live the instant they're created now, so "approved" no
    // longer means "might have buyers" the way it used to — an event can be
    // approved and five seconds old with nobody to protect yet. The real
    // question for how much editing freedom to allow is whether anyone has
    // actually bought a ticket: zero sales means free editing of everything
    // (no one to notify, nothing to cap); any sale means name/category lock
    // and venue/date changes route through the refund-window + cap system.
    const { count: soldCount } = await db
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id);
    const hasSales = (soldCount ?? 0) > 0;

    let allowedFields: string[];
    if (hasSales) {
      allowedFields = ['description', 'banner_url', 'date', 'time', 'venue', 'address', 'city', 'landmark', 'location_hidden', 'meeting_link', 'meeting_passcode', 'accent_color', 'lineup', 'allowed_email_domains', 'venue_contact_name', 'venue_contact_phone', 'lga', 'address_reveal_at'];
    } else {
      allowedFields = ['event_name', 'description', 'date', 'time', 'venue', 'address', 'city', 'landmark', 'location_hidden', 'meeting_link', 'meeting_passcode', 'category', 'banner_url', 'accent_color', 'lineup', 'allowed_email_domains', 'venue_contact_name', 'venue_contact_phone', 'lga', 'address_reveal_at'];
    }

    const updates: Record<string, string | boolean | null | LineupAct[] | string[] | RefundPolicyAnswers> = {};

    // Refund policy (Organiser Terms 4.4): free to set or change until a
    // ticket is sold; an event already selling without one may set it once.
    // After that it is what buyers paid under, so it is locked.
    if (body.refund_policy !== undefined) {
      if (hasSales && event.refund_policy) {
        return NextResponse.json({ error: 'Tickets have been sold under this refund policy, so it can\u2019t be changed. Contact support if something is wrong.' }, { status: 409 });
      }
      const parsed = parseRefundPolicy(body.refund_policy);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      updates.refund_policy = parsed.value;
      updates.refund_policy_set_at = new Date().toISOString();
    }
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        if (key === 'location_hidden') {
          updates[key] = Boolean(body[key]);
        } else if (key === 'accent_color') {
          const value = body[key];
          updates[key] = isValidAccentColor(value) ? value : null;
        } else if (key === 'lineup') {
          try {
            updates[key] = normalizeLineup(body[key]);
          } catch (err) {
            return NextResponse.json({ error: (err as Error).message }, { status: 400 });
          }
        } else if (key === 'allowed_email_domains') {
          const normalized = normalizeEmailDomains(body[key]);
          updates[key] = normalized.length > 0 ? normalized : null;
        } else if (key === 'address_reveal_at') {
          const v = String(body[key] ?? '').trim();
          updates[key] = v ? new Date(v).toISOString() : null;
        } else if (key === 'landmark' || key === 'meeting_passcode' || key === 'venue_contact_name' || key === 'venue_contact_phone' || key === 'lga') {
          updates[key] = String(body[key] ?? '').trim() || null;
        } else {
          updates[key] = String(body[key] ?? '').trim();
        }
      }
    }

    // Scheduled go-live: movable as often as the organiser likes while the
    // event is still waiting. Clearing it (or picking a time already past)
    // means "go live now". Once an event is live and selling it can't be
    // pulled back off sale this way.
    const scheduledNow = isScheduled(event.goes_live_at);
    if (body.goes_live_at !== undefined) {
      const raw = String(body.goes_live_at ?? '').trim();
      const want = raw ? new Date(raw) : null;
      if (want && Number.isNaN(want.getTime())) {
        return NextResponse.json({ error: 'That go-live time isn\u2019t valid' }, { status: 400 });
      }
      const wantIso = want ? want.toISOString() : null;
      if (isScheduled(wantIso)) {
        if (!scheduledNow && hasSales) {
          return NextResponse.json({ error: 'Tickets have already been sold, so this event can\u2019t be taken off sale.' }, { status: 409 });
        }
        if (wantIso !== event.goes_live_at) {
          updates.goes_live_at = wantIso;
          updates.live_notified_at = null;
        }
      } else if (scheduledNow) {
        // Go live now; the go-live cron sends the "your event is live" email.
        updates.goes_live_at = new Date().toISOString();
      }
    }
    const finalGoLive = (updates.goes_live_at as string | null | undefined) ?? event.goes_live_at;
    if (isScheduled(finalGoLive)) {
      const problem = goLiveProblem(finalGoLive, String(updates.date ?? event.date), String(updates.time ?? event.time));
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Organiser Terms 4.9: a hidden address needs a reveal time no later than
    // 24 hours before doors (checked against the date/time after this edit).
    if (event.event_mode !== 'online') {
      const hidden = Boolean(updates.location_hidden ?? event.location_hidden);
      if (hidden && ('location_hidden' in updates || 'address_reveal_at' in updates || 'date' in updates || 'time' in updates)) {
        const problem = revealTimeProblem(
          (updates.address_reveal_at as string | null | undefined) ?? event.address_reveal_at,
          String(updates.date ?? event.date),
          String(updates.time ?? event.time),
        );
        if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      }
    }

    const dateChanged = 'date' in updates && String(updates.date) !== String(event.date ?? '');
    if (dateChanged) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (String(updates.date) < todayStr) {
        return NextResponse.json({ error: 'New event date cannot be in the past' }, { status: 400 });
      }
    }

    const newDate = String(updates.date ?? event.date);
    const newTime = String(updates.time ?? event.time);

    // ── Postponement rules (Organiser Terms 10, Refund Policy 8) ──
    // Before any ticket is sold, date/venue/time edit freely. After that:
    //   • a date or venue change is the event's one postponement;
    //   • nothing can move within 7 days of the event;
    //   • a new date must be within 30 days of the original date and at
    //     least 7 days after today;
    //   • a same-day time change is fine, except within 2 days of the event.
    let isPostponement = false;
    let timeMoved = false;
    if (hasSales) {
      const DAY = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const currentStart = eventStart(String(event.date), event.time).getTime();
      const venueMoved = event.event_mode !== 'online' && ['venue', 'address', 'city'].some(k =>
        k in updates && String(updates[k] ?? '') !== String(event[k as keyof typeof event] ?? ''));
      timeMoved = 'time' in updates && String(updates.time) !== String(event.time ?? '');
      isPostponement = dateChanged || venueMoved;
      const support = 'Contact support if the event can\u2019t go ahead as listed: it will be treated as a cancellation.';

      if (isPostponement) {
        if ((event.postponement_count ?? 0) >= 1) {
          return NextResponse.json({ error: `This event has already been postponed once, which is the limit once tickets are sold. ${support}` }, { status: 400 });
        }
        if (currentStart - now < 7 * DAY) {
          return NextResponse.json({ error: `The date and venue can\u2019t change within 7 days of the event. ${support}` }, { status: 400 });
        }
        if (dateChanged) {
          const original = String(event.original_date ?? event.date).slice(0, 10);
          const newDay = new Date(`${newDate}T12:00:00Z`).getTime();
          const originalDay = new Date(`${original}T12:00:00Z`).getTime();
          if (Math.abs(newDay - originalDay) > 30 * DAY) {
            return NextResponse.json({ error: 'A postponed date must fall within 30 days of the original event date.' }, { status: 400 });
          }
          if (eventStart(newDate, newTime).getTime() - now < 7 * DAY) {
            return NextResponse.json({ error: 'The new date must be at least 7 days from today, so buyers have reasonable notice.' }, { status: 400 });
          }
        }
      } else if (timeMoved && currentStart - now < 2 * DAY) {
        return NextResponse.json({ error: 'The start time can\u2019t change within 2 days of the event.' }, { status: 400 });
      }
    }

    const coreVenueChanged = event.event_mode !== 'online' && ['venue', 'address', 'city'].some((key) => {
      if (!(key in updates)) return false;
      return String(updates[key] ?? '') !== String(event[key as keyof typeof event] ?? '');
    });

    if (Object.keys(updates).length > 0) {
      const { error } = await db.from('events').update(updates).eq('id', id);
      if (error) throw error;
    }

    if (isPostponement) {
      await db.from('events').update({
        postponement_count: (event.postponement_count ?? 0) + 1,
        original_date: event.original_date ?? event.date,
        postponed_at: new Date().toISOString(),
      }).eq('id', id);
    }

    // Tell ticket holders, and open a refund claim window where the
    // organiser's published policy offers one (Refund Policy §8).
    if (hasSales && (isPostponement || timeMoved)) {
      const fmtDate = (d: string) => new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      const lines: string[] = [];
      if (dateChanged) {
        lines.push(`New date: ${fmtDate(newDate)}, ${newTime}`, `Was: ${fmtDate(String(event.date))}, ${event.time}`);
      } else if (timeMoved) {
        lines.push(`New start time: ${newTime} on ${fmtDate(newDate)}`, `Was: ${event.time}`);
      }
      if (coreVenueChanged) {
        const hiddenNow = addressHiddenNow({
          location_hidden: Boolean(updates.location_hidden ?? event.location_hidden),
          address_reveal_at: (updates.address_reveal_at as string | null | undefined) ?? event.address_reveal_at,
          date: newDate, time: newTime,
        });
        const area = [updates.lga ?? event.lga, updates.city ?? event.city].filter(Boolean).join(', ');
        lines.push(hiddenNow
          ? `New venue area: ${area}. The exact address is emailed to you at the reveal time.`
          : `New venue: ${[updates.venue ?? event.venue, updates.address ?? event.address, updates.city ?? event.city].filter(Boolean).join(', ')}`);
      }
      await handleEventChange(db, {
        eventId: id,
        kind: dateChanged ? 'postponement' : coreVenueChanged ? 'venue_change' : 'time_change',
        changeLines: lines,
        changedAt: new Date(),
      }).catch(err => console.error('event change notices error', err));
    }

    if (event.event_mode === 'online') {
      const meetingChanged = ['meeting_link', 'meeting_passcode'].some((key) => {
        if (!(key in updates)) return false;
        return String(updates[key] ?? '') !== String(event[key as keyof typeof event] ?? '');
      });

      if (meetingChanged) {
        notifyTicketBuyersOfMeetingLinkChange(db, {
          eventId: id,
          eventName: event.event_name,
          eventDate: event.date,
          eventTime: event.time,
          meetingLink: String(updates.meeting_link ?? event.meeting_link ?? ''),
          meetingPasscode: String(updates.meeting_passcode ?? event.meeting_passcode ?? ''),
        }).catch(err => console.error('meeting link update buyer notification error', err));
      }

    } else {
      const locationFields = ['venue', 'address', 'city', 'landmark', 'location_hidden'];
      const locationChanged = locationFields.some((key) => {
        if (!(key in updates)) return false;
        return String(updates[key] ?? '') !== String(event[key as keyof typeof event] ?? '');
      });

      if (hasSales && (coreVenueChanged || dateChanged)) {
        // Buyers were told above (with any refund option).
      } else if (locationChanged) {
        // Landmark-only or hide/reveal-only change — no refund implication,
        // just let buyers know the listing details moved.
        const nextLocation = {
          venue: String(updates.venue ?? event.venue ?? ''),
          address: String(updates.address ?? event.address ?? ''),
          city: String(updates.city ?? event.city ?? ''),
          landmark: String(updates.landmark ?? event.landmark ?? ''),
          locationHidden: Boolean(updates.location_hidden ?? event.location_hidden),
        };

        notifyTicketBuyersOfLocationChange(db, {
          eventId: id,
          eventSlug: event.slug,
          eventName: event.event_name,
          eventDate: event.date,
          eventTime: event.time,
          ...nextLocation,
        }).catch(err => console.error('location update buyer notification error', err));
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/organizer/events/[id] error', err);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

async function notifyTicketBuyersOfLocationChange(
  db: ReturnType<typeof getServerSupabase>,
  event: {
    eventId: string;
    eventSlug: string;
    eventName: string;
    eventDate: string;
    eventTime: string;
    venue: string;
    address: string;
    city: string;
    landmark: string;
    locationHidden: boolean;
  },
) {
  const { data: tickets, error } = await db
    .from('tickets')
    .select('buyer_email, buyer_name')
    .eq('event_id', event.eventId)
    .in('status', ['valid', 'used']);

  if (error) throw error;

  const buyers = new Map<string, string>();
  for (const ticket of tickets ?? []) {
    const email = String(ticket.buyer_email ?? '').toLowerCase().trim();
    if (email) buyers.set(email, String(ticket.buyer_name ?? ''));
  }

  await Promise.all(
    [...buyers.entries()].map(([to, buyerName]) =>
      sendLocationUpdatedEmail({
        to,
        buyerName,
        eventName: event.eventName,
        eventDate: event.eventDate,
        eventTime: event.eventTime,
        venue: event.venue,
        address: event.address,
        city: event.city,
        landmark: event.landmark,
        eventUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${event.eventSlug}`,
      }).catch(err => console.error('sendLocationUpdatedEmail error', { to, err })),
    ),
  );
}

async function notifyTicketBuyersOfMeetingLinkChange(
  db: ReturnType<typeof getServerSupabase>,
  event: {
    eventId: string;
    eventName: string;
    eventDate: string;
    eventTime: string;
    meetingLink: string;
    meetingPasscode: string;
  },
) {
  const { data: tickets, error } = await db
    .from('tickets')
    .select('buyer_email, buyer_name')
    .eq('event_id', event.eventId)
    .in('status', ['valid', 'used']);

  if (error) throw error;

  const buyers = new Map<string, string>();
  for (const ticket of tickets ?? []) {
    const email = String(ticket.buyer_email ?? '').toLowerCase().trim();
    if (email) buyers.set(email, String(ticket.buyer_name ?? ''));
  }

  await Promise.all(
    [...buyers.entries()].map(([to, buyerName]) =>
      sendMeetingLinkUpdatedEmail({
        to,
        buyerName,
        eventName: event.eventName,
        eventDate: event.eventDate,
        eventTime: event.eventTime,
        meetingLink: event.meetingLink,
        meetingPasscode: event.meetingPasscode || undefined,
      }).catch(err => console.error('sendMeetingLinkUpdatedEmail error', { to, err })),
    ),
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('id, organizer_id, status')
      .eq('id', id)
      .single();

    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.status === 'approved') {
      return NextResponse.json({ error: 'Cannot delete an approved event' }, { status: 403 });
    }

    await db.from('events').delete().eq('id', id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/organizer/events/[id] error', err);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
