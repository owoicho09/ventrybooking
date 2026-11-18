import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendEventApprovedEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';
import { sendSubscriberTeasers } from '@/lib/server/eventTeasers';
import { isScheduled, isInactive, fmtGoLive } from '@/lib/goLive';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('event_name, slug, date, status, goes_live_at, organizer:users!events_organizer_id_fkey(id, name, email, handle)')
      .eq('id', id)
      .single();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.status !== 'under_review' && event.status !== 'rejected') {
      return NextResponse.json({ error: 'Only events waiting for review (or rejected) can be approved' }, { status: 400 });
    }

    // A scheduled event stays hidden until its go-live time; the go-live cron
    // announces it then (live_notified_at null). Otherwise it is public now,
    // so mark it announced here and the cron leaves it alone.
    const scheduled = isScheduled(event.goes_live_at);
    const now = new Date().toISOString();

    // Conditional on the status we just read, so a double-click (or two
    // admins at once) can't approve it twice and email everyone twice.
    const { data: claimed, error: updErr } = await db
      .from('events')
      .update({
        status: 'approved',
        reviewed_at: now,
        reviewed_by: user.email ?? null,
        rejection_reason: null,
        live_notified_at: scheduled ? null : now,
      })
      .eq('id', id)
      .eq('status', event.status)
      .select('id');
    if (updErr) throw updErr;
    if (!claimed?.length) return NextResponse.json({ error: 'This event was already reviewed' }, { status: 409 });

    const organizerRaw = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
    const organizer = organizerRaw as { id: string; name: string; email: string; handle: string | null } | null;
    const liveAt = scheduled ? fmtGoLive(event.goes_live_at as string) : null;

    if (organizer?.email && event.slug) {
      await sendEventApprovedEmail(organizer.email, organizer.name, event.event_name, event.slug, liveAt, isInactive(event.goes_live_at)).catch(console.error);
    }
    if (organizer?.id) {
      notify(
        { type: 'organizer', id: organizer.id },
        {
          notifType: 'event',
          title: 'Event Approved',
          body: liveAt
            ? `"${event.event_name}" was approved and goes on sale ${liveAt}.`
            : `"${event.event_name}" is now live and accepting ticket sales.`,
          link: `/organizer/events/${id}`,
        },
      ).catch(console.error);
    }

    if (!scheduled) await sendSubscriberTeasers(db, organizer, event);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('approve event error', err);
    return NextResponse.json({ error: 'Failed to approve event' }, { status: 500 });
  }
}
