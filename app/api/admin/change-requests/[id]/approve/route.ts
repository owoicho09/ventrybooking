import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { createChangeRefundWindow } from '@/lib/server/eventChangeWindow';
import { sendChangeRequestDecisionEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServerSupabase();

  const { data: request } = await db
    .from('event_change_requests')
    .select('id, event_id, organizer_id, change_type, old_value, new_value, status')
    .eq('id', id)
    .maybeSingle();

  if (!request) return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'This request has already been reviewed' }, { status: 400 });
  }

  const { data: event } = await db
    .from('events')
    .select('id, slug, event_name, date, time, venue, address, city')
    .eq('id', request.event_id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const newValue = request.new_value as Record<string, string | undefined>;

  // Apply only the fields this request actually carries.
  const applyUpdates: Record<string, string> = {};
  if (newValue.date) applyUpdates.date = newValue.date;
  if (newValue.time) applyUpdates.time = newValue.time;
  if (newValue.venue) applyUpdates.venue = newValue.venue;
  if (newValue.address) applyUpdates.address = newValue.address;
  if (newValue.city) applyUpdates.city = newValue.city;

  if (Object.keys(applyUpdates).length > 0) {
    const { error: updateErr } = await db.from('events').update(applyUpdates).eq('id', event.id);
    if (updateErr) {
      console.error('approve change request: event update error', updateErr);
      return NextResponse.json({ error: 'Failed to apply the change' }, { status: 500 });
    }
  }

  const { error: reviewErr } = await db
    .from('event_change_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user.email })
    .eq('id', id);
  if (reviewErr) console.error('approve change request: status update error', reviewErr);

  const newEventDate = newValue.date ?? event.date;
  const newEventTime = newValue.time ?? event.time;
  const hasVenue = request.change_type === 'venue' || request.change_type === 'venue_and_date';

  try {
    await createChangeRefundWindow(db, {
      eventId: event.id,
      eventSlug: event.slug,
      eventName: event.event_name,
      changeType: request.change_type as 'venue' | 'date' | 'venue_and_date',
      oldValue: request.old_value as Record<string, unknown>,
      newValue: request.new_value as Record<string, unknown>,
      newEventDate,
      newEventTime,
      location: hasVenue
        ? { venue: newValue.venue ?? event.venue, address: newValue.address ?? event.address, city: newValue.city ?? event.city }
        : undefined,
    });
  } catch (err) {
    console.error('approve change request: refund window error', err);
  }

  const { data: organizer } = await db.from('users').select('name, email').eq('id', request.organizer_id).maybeSingle();
  if (organizer) {
    sendChangeRequestDecisionEmail({
      to: organizer.email,
      organizerName: organizer.name,
      eventName: event.event_name,
      approved: true,
    }).catch(err => console.error('sendChangeRequestDecisionEmail error', err));
  }

  notify(
    { type: 'organizer', id: request.organizer_id },
    {
      notifType: 'event_change_request',
      title: `Change approved — ${event.event_name}`,
      body: 'Your requested venue/date change has been approved and is now live. Buyers have been notified.',
      link: '/organizer/dashboard',
    },
  ).catch(console.error);

  return NextResponse.json({ success: true });
}
