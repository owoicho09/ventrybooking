import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendEventRejectedEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';

/**
 * Rejects an event: it becomes 'rejected' (hidden, not on sale) with the
 * reason kept on the row, so the organiser can fix it and resubmit from
 * their event page. Nothing is deleted.
 *
 * Works on an event waiting for review, or on a live event that has not sold
 * anything. A live event with tickets sold must go through "Cancel Event &
 * Refund All Buyers" so buyers actually get their money back.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { reason?: string };
    const reason = String(body.reason ?? '').trim().slice(0, 1000);
    if (!reason) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });

    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('event_name, status, organizer:users!events_organizer_id_fkey(id, name, email)')
      .eq('id', id)
      .single();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.status !== 'under_review' && event.status !== 'approved') {
      return NextResponse.json({ error: `A ${event.status.replace('_', ' ')} event can't be rejected` }, { status: 400 });
    }

    const { count: soldCount } = await db
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id);
    if (soldCount && soldCount > 0) {
      return NextResponse.json(
        { error: `This event already has ${soldCount} ticket(s) sold — use "Cancel Event & Refund All Buyers" instead so buyers actually get refunded.` },
        { status: 400 },
      );
    }

    const { data: claimed, error: updErr } = await db
      .from('events')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.email ?? null,
      })
      .eq('id', id)
      .eq('status', event.status)
      .select('id');
    if (updErr) throw updErr;
    if (!claimed?.length) return NextResponse.json({ error: 'This event was already reviewed' }, { status: 409 });

    const organizerRaw = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
    const organizer = organizerRaw as { id: string; name: string; email: string } | null;
    if (organizer?.email) {
      await sendEventRejectedEmail(organizer.email, organizer.name, event.event_name, reason, id).catch(console.error);
    }
    if (organizer?.id) {
      notify(
        { type: 'organizer', id: organizer.id },
        { notifType: 'event', title: 'Event Not Approved', body: `"${event.event_name}" was not approved: ${reason}`, link: `/organizer/events/${id}` },
        { emailChannel: 'dedicated' },
      ).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('reject event error', err);
    return NextResponse.json({ error: 'Failed to reject event' }, { status: 500 });
  }
}
