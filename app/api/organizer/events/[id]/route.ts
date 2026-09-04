import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendLocationUpdatedEmail, sendMeetingLinkUpdatedEmail } from '@/lib/server/email';
import { isValidAccentColor } from '@/lib/accentColors';
import { normalizeLineup, type LineupAct } from '@/lib/server/lineup';
import { normalizeEmailDomains } from '@/lib/server/domainRestriction';
import { createChangeRefundWindow, countAppliedEventChanges, FREE_ORGANIZER_CHANGE_LIMIT } from '@/lib/server/eventChangeWindow';
import { notify } from '@/lib/server/notify';

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
        location_hidden, meeting_link, meeting_passcode, status, total_sold, banner_color, banner_url, header_banner_url, accent_color, lineup, allowed_email_domains, organizer_id, created_at,
        tiers:ticket_tiers(id, name, price, available, sold)
      `)
      .eq('id', id)
      .eq('organizer_id', user.sub)
      .maybeSingle();

    if (error) throw error;
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: event });
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
      .select('id, slug, organizer_id, status, event_name, date, time, event_mode, venue, address, city, landmark, location_hidden, meeting_link, meeting_passcode')
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
      allowedFields = ['description', 'banner_url', 'date', 'time', 'venue', 'address', 'city', 'landmark', 'location_hidden', 'meeting_link', 'meeting_passcode', 'accent_color', 'lineup', 'allowed_email_domains'];
    } else {
      allowedFields = ['event_name', 'description', 'date', 'time', 'venue', 'address', 'city', 'landmark', 'location_hidden', 'meeting_link', 'meeting_passcode', 'category', 'banner_url', 'accent_color', 'lineup', 'allowed_email_domains'];
    }

    const updates: Record<string, string | boolean | null | LineupAct[] | string[]> = {};
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
        } else if (key === 'landmark' || key === 'meeting_passcode') {
          updates[key] = String(body[key] ?? '').trim() || null;
        } else {
          updates[key] = String(body[key] ?? '').trim();
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
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

    // Only venue/address/city (physical) or date (either mode) are
    // "qualifying" — the ones that mean the thing the buyer bought a ticket
    // for has actually changed, and so are subject to the 2-free-changes cap.
    const coreVenueChanged = event.event_mode !== 'online' && ['venue', 'address', 'city'].some((key) => {
      if (!(key in updates)) return false;
      return String(updates[key] ?? '') !== String(event[key as keyof typeof event] ?? '');
    });
    // With no tickets sold, there's no buyer to protect and no reason to
    // spend one of the 2 free changes — let it through untracked.
    const qualifyingChangeRequested = hasSales && (coreVenueChanged || dateChanged);

    let deferredToApproval = false;
    let changeRequestId: string | null = null;

    if (qualifyingChangeRequested) {
      const appliedCount = await countAppliedEventChanges(db, id);
      if (appliedCount >= FREE_ORGANIZER_CHANGE_LIMIT) {
        deferredToApproval = true;

        const deferredOld: Record<string, unknown> = {};
        const deferredNew: Record<string, unknown> = {};
        if (dateChanged) {
          deferredOld.date = event.date;
          deferredOld.time = event.time;
          deferredNew.date = updates.date;
          deferredNew.time = updates.time ?? event.time;
          delete updates.date;
          delete updates.time;
        }
        if (coreVenueChanged) {
          deferredOld.venue = event.venue;
          deferredOld.address = event.address;
          deferredOld.city = event.city;
          deferredNew.venue = updates.venue ?? event.venue;
          deferredNew.address = updates.address ?? event.address;
          deferredNew.city = updates.city ?? event.city;
          delete updates.venue;
          delete updates.address;
          delete updates.city;
        }
        const changeType = dateChanged && coreVenueChanged ? 'venue_and_date' : dateChanged ? 'date' : 'venue';

        const { data: reqRow, error: reqErr } = await db
          .from('event_change_requests')
          .insert({
            event_id: id,
            organizer_id: user.sub,
            change_type: changeType,
            old_value: deferredOld,
            new_value: deferredNew,
          })
          .select('id')
          .single();
        if (reqErr) throw reqErr;
        changeRequestId = reqRow.id;

        notify(
          { type: 'admin' },
          {
            notifType: 'event_change_request',
            title: `Change request awaiting approval — ${event.event_name}`,
            body: `A ${changeType.replace('_', ' ')} change was requested. This event has already had its 2 included organiser changes, so this one needs your approval before it applies or buyers are notified.`,
            link: '/admin/change-requests',
          },
          { emailChannel: 'immediate' },
        ).catch(console.error);
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await db.from('events').update(updates).eq('id', id);
      if (error) throw error;
    }

    if (deferredToApproval) {
      return NextResponse.json({ success: true, data: { pendingApproval: true, changeRequestId } });
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

      // Meeting-link-only changes don't warrant a refund window — but a date
      // change does, whether the event is online or physical. Skipped entirely
      // with zero sales — nothing to notify, and it shouldn't spend a change.
      if (hasSales && dateChanged) {
        createChangeRefundWindow(db, {
          eventId: id,
          eventSlug: event.slug,
          eventName: event.event_name,
          changeType: 'date',
          oldValue: { date: event.date, time: event.time },
          newValue: { date: newDate, time: newTime },
          newEventDate: newDate,
          newEventTime: newTime,
        }).catch(err => console.error('date change refund window error', err));
      }
    } else {
      const locationFields = ['venue', 'address', 'city', 'landmark', 'location_hidden'];
      const locationChanged = locationFields.some((key) => {
        if (!(key in updates)) return false;
        return String(updates[key] ?? '') !== String(event[key as keyof typeof event] ?? '');
      });

      if (hasSales && (coreVenueChanged || dateChanged)) {
        const nextLocation = {
          venue: String(updates.venue ?? event.venue ?? ''),
          address: String(updates.address ?? event.address ?? ''),
          city: String(updates.city ?? event.city ?? ''),
        };

        createChangeRefundWindow(db, {
          eventId: id,
          eventSlug: event.slug,
          eventName: event.event_name,
          changeType: coreVenueChanged && dateChanged ? 'venue_and_date' : coreVenueChanged ? 'venue' : 'date',
          oldValue: { venue: event.venue, address: event.address, city: event.city, date: event.date, time: event.time },
          newValue: { ...nextLocation, date: newDate, time: newTime },
          newEventDate: newDate,
          newEventTime: newTime,
          location: nextLocation,
        }).catch(err => console.error('venue/date change refund window error', err));
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
