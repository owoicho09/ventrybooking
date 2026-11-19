import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { notify } from '@/lib/server/notify';
import { sendOrganizerNoticeEmail } from '@/lib/server/email';

/**
 * Decline an organiser's cancellation request (061): the request is cleared,
 * ticket sales resume and the organiser is told why. To accept a request the
 * admin uses the normal Cancel Event flow, which runs the refund process.
 * Body: { note }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { note } = await req.json().catch(() => ({})) as { note?: string };
  const why = String(note ?? '').trim().slice(0, 1000);
  if (!why) return NextResponse.json({ error: 'Add a short note for the organiser' }, { status: 400 });

  const db = getServerSupabase();
  const { data: event } = await db
    .from('events')
    .select('id, event_name, status, cancel_requested_at, sales_paused_reason, organizer:users!events_organizer_id_fkey(id, name, email)')
    .eq('id', id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (!event.cancel_requested_at) return NextResponse.json({ error: 'There is no pending cancellation request' }, { status: 400 });

  const updates: Record<string, unknown> = { cancel_requested_at: null, cancel_request_reason: null };
  if (event.sales_paused_reason === 'cancel_requested') updates.sales_paused_reason = null;
  const { error } = await db.from('events').update(updates).eq('id', id);
  if (error) {
    console.error('decline cancel request error', error);
    return NextResponse.json({ error: 'Could not update the event' }, { status: 500 });
  }

  const org = (Array.isArray(event.organizer) ? event.organizer[0] : event.organizer) as { id: string; name: string; email: string } | null;
  if (org) {
    notify({ type: 'organizer', id: org.id }, {
      notifType: 'event',
      title: 'Cancellation request declined',
      body: `Ventry didn't cancel "${event.event_name}". Ticket sales have resumed. Note: ${why}`,
      link: `/organizer/events/${id}`,
    }).catch(err => console.error('decline cancel: notify failed', err));
    if (org.email) {
      await sendOrganizerNoticeEmail({
        to: org.email,
        organizerName: org.name,
        subject: `Your cancellation request for "${event.event_name}"`,
        heading: 'Cancellation request declined',
        lines: [
          `We haven't cancelled "${event.event_name}", and ticket sales have resumed.`,
          `Note from Ventry: ${why}`,
          'If the event can’t go ahead, reply to this email and we’ll help.',
        ],
        ctaLabel: 'Open the event',
        ctaPath: `/organizer/events/${id}`,
        purpose: 'cancel_request_declined',
      }).catch(err => console.error('decline cancel: email failed', err));
    }
  }
  return NextResponse.json({ success: true });
}
