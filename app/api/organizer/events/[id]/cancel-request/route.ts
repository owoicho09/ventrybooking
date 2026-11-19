import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { notify } from '@/lib/server/notify';

/**
 * An organiser asks Ventry to cancel an event that has sold tickets (061).
 * Ticket sales pause straight away; an admin then cancels it (the normal
 * refund process runs) or declines. With no ticket sold the organiser can
 * simply delete the event instead.
 *
 * POST   { reason }  file the request
 * DELETE             withdraw it (sales resume)
 */

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string, organizerId: string) {
  const db = getServerSupabase();
  const { data: event } = await db
    .from('events')
    .select('id, event_name, status, organizer_id, cancel_requested_at, sales_paused_reason')
    .eq('id', id)
    .maybeSingle();
  return { db, event: event && event.organizer_id === organizerId ? event : null };
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { reason } = await req.json().catch(() => ({})) as { reason?: string };
  const why = String(reason ?? '').trim().slice(0, 1000);
  if (why.length < 10) {
    return NextResponse.json({ error: 'Tell us briefly why the event is being cancelled (at least a sentence).' }, { status: 400 });
  }

  try {
    const { db, event } = await load(id, user.sub);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.status !== 'approved') {
      return NextResponse.json({ error: 'Only a live event can be cancelled. Events that haven’t sold can be deleted instead.' }, { status: 400 });
    }
    if (event.cancel_requested_at) {
      return NextResponse.json({ error: 'You’ve already asked to cancel this event. Ventry will be in touch.' }, { status: 409 });
    }
    const { count } = await db.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', id);
    if ((count ?? 0) === 0) {
      return NextResponse.json({ error: 'No tickets have been sold, so you can delete this event from My Events instead.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await db.from('events')
      .update({ cancel_requested_at: now, cancel_request_reason: why, sales_paused_reason: 'cancel_requested' })
      .eq('id', id).is('cancel_requested_at', null);
    if (error) throw error;

    await notify(
      { type: 'admin' },
      {
        notifType: 'event',
        title: `Cancellation requested: ${event.event_name}`,
        body: `The organiser asked to cancel "${event.event_name}" (${count} ticket${count === 1 ? '' : 's'} sold). Sales are paused. Reason: ${why}`,
        link: '/admin/events',
      },
      { emailChannel: 'immediate' },
    ).catch(err => console.error('cancel-request: admin notify failed', err));

    return NextResponse.json({ success: true, data: { cancelRequestedAt: now } });
  } catch (err) {
    console.error('POST /api/organizer/events/[id]/cancel-request error', err);
    return NextResponse.json({ error: 'Could not send your request' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const { db, event } = await load(id, user.sub);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (!event.cancel_requested_at) return NextResponse.json({ success: true });
    if (event.status !== 'approved') {
      return NextResponse.json({ error: 'This event has already been cancelled.' }, { status: 409 });
    }
    // Resume sales only if this request is what paused them.
    const updates: Record<string, unknown> = { cancel_requested_at: null, cancel_request_reason: null };
    if (event.sales_paused_reason === 'cancel_requested') updates.sales_paused_reason = null;
    const { error } = await db.from('events').update(updates).eq('id', id);
    if (error) throw error;

    await notify(
      { type: 'admin' },
      { notifType: 'event', title: `Cancellation withdrawn: ${event.event_name}`, body: `The organiser withdrew their request to cancel "${event.event_name}". Sales have resumed.`, link: '/admin/events' },
    ).catch(err => console.error('cancel-request withdraw: notify failed', err));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/organizer/events/[id]/cancel-request error', err);
    return NextResponse.json({ error: 'Could not withdraw your request' }, { status: 500 });
  }
}
