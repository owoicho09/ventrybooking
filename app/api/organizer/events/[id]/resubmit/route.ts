import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { notify } from '@/lib/server/notify';
import { sendAdminNewEventEmail, sendEventSubmittedEmail } from '@/lib/server/email';
import { goLiveProblem, isScheduled } from '@/lib/goLive';

/**
 * A rejected event goes back into the review queue after the organiser has
 * fixed it. The previous rejection reason stays on the row until an admin
 * decides again, so the reviewer can see what was asked for.
 */
export async function POST(
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
      .select('id, organizer_id, status, event_name, date, time, city, event_mode, goes_live_at, organizer:users!events_organizer_id_fkey(name, email)')
      .eq('id', id)
      .maybeSingle();

    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.status !== 'rejected') {
      return NextResponse.json({ error: 'Only an event that was not approved can be resubmitted' }, { status: 400 });
    }
    if (new Date(`${event.date}T23:59:59+01:00`).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This event date has passed. Change the date before resubmitting.' }, { status: 400 });
    }
    // A go-live time that is still in the future must still sit before the event.
    if (isScheduled(event.goes_live_at)) {
      const problem = goLiveProblem(event.goes_live_at as string, String(event.date), String(event.time));
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    }

    const { data: claimed, error } = await db
      .from('events')
      .update({ status: 'under_review', submitted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'rejected')
      .select('id');
    if (error) throw error;
    if (!claimed?.length) return NextResponse.json({ error: 'This event was already resubmitted' }, { status: 409 });

    const org = (Array.isArray(event.organizer) ? event.organizer[0] : event.organizer) as { name: string | null; email: string } | null;

    notify(
      { type: 'admin' },
      { notifType: 'event', title: 'Event Resubmitted', body: `"${event.event_name}" was fixed and resubmitted for review.`, link: '/admin/events' },
      { emailChannel: 'dedicated' },
    ).catch(console.error);
    sendAdminNewEventEmail({
      eventName: event.event_name,
      organizerName: org?.name || 'An organiser',
      eventDate: String(event.date),
      city: event.event_mode === 'online' ? 'Online' : (event.city || 'Not specified'),
      eventId: id,
      resubmitted: true,
    }).catch(err => console.error('resubmit: admin email error', err));
    if (org?.email) {
      sendEventSubmittedEmail({ to: org.email, organizerName: org.name || 'there', eventName: event.event_name, eventId: id, resubmitted: true })
        .catch(err => console.error('resubmit: organiser email error', err));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/organizer/events/[id]/resubmit error', err);
    return NextResponse.json({ error: 'Failed to resubmit event' }, { status: 500 });
  }
}
