import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendLocationUpdatedEmail, sendMeetingLinkUpdatedEmail } from '@/lib/server/email';
import { ACCENT_COLOR_PRESETS } from '@/lib/accentColors';

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
        location_hidden, meeting_link, meeting_passcode, status, total_sold, banner_color, banner_url, accent_color, lineup, organizer_id, created_at,
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

    let allowedFields: string[];
    if (event.status === 'approved') {
      // After approval: keep identity/date locked, but allow operational location updates.
      allowedFields = ['description', 'banner_url', 'venue', 'address', 'city', 'landmark', 'location_hidden', 'meeting_link', 'meeting_passcode', 'accent_color', 'lineup'];
    } else {
      // Before approval: all fields except organizer_id, status and event_mode (mode is locked at creation)
      allowedFields = ['event_name', 'description', 'date', 'time', 'venue', 'address', 'city', 'landmark', 'location_hidden', 'meeting_link', 'meeting_passcode', 'category', 'banner_url', 'accent_color', 'lineup'];
    }

    const updates: Record<string, string | boolean | null | { name: string; role: string }[]> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        if (key === 'location_hidden') {
          updates[key] = Boolean(body[key]);
        } else if (key === 'accent_color') {
          const value = body[key];
          updates[key] = value && ACCENT_COLOR_PRESETS.some(p => p.hex === value) ? value : null;
        } else if (key === 'lineup') {
          updates[key] = Array.isArray(body[key])
            ? body[key].map((a: { name?: string; role?: string }) => ({ name: String(a.name ?? '').trim(), role: String(a.role ?? '').trim() })).filter((a: { name: string }) => a.name)
            : [];
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

    const { error } = await db.from('events').update(updates).eq('id', id);
    if (error) throw error;

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

      if (locationChanged) {
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
