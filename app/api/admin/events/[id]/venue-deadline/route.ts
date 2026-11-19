import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { notify } from '@/lib/server/notify';
import { sendOrganizerNoticeEmail } from '@/lib/server/email';

/**
 * Allow more time for a venue-to-be-announced event that missed its 7-day
 * deadline (061): ticket sales resume and the deadline job leaves it alone.
 * To cancel instead, the admin uses the normal Cancel Event flow.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const db = getServerSupabase();

  const { data: event } = await db
    .from('events')
    .select('id, event_name, venue_tba, sales_paused_reason, organizer:users!events_organizer_id_fkey(id, name, email)')
    .eq('id', id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (!event.venue_tba) return NextResponse.json({ error: 'This event already has its venue' }, { status: 400 });

  const updates: Record<string, unknown> = { venue_deadline_extended_at: new Date().toISOString() };
  if (event.sales_paused_reason === 'venue_missing') updates.sales_paused_reason = null;
  const { error } = await db.from('events').update(updates).eq('id', id);
  if (error) {
    console.error('venue-deadline extend error', error);
    return NextResponse.json({ error: 'Could not update the event' }, { status: 500 });
  }

  const org = (Array.isArray(event.organizer) ? event.organizer[0] : event.organizer) as { id: string; name: string; email: string } | null;
  if (org) {
    notify({ type: 'organizer', id: org.id }, {
      notifType: 'event',
      title: 'More time to add your venue',
      body: `Ventry has resumed ticket sales for "${event.event_name}". Please add the venue as soon as you can.`,
      link: `/organizer/events/${id}`,
    }).catch(() => {});
    if (org.email) {
      await sendOrganizerNoticeEmail({
        to: org.email,
        organizerName: org.name,
        subject: `Ticket sales resumed for "${event.event_name}"`,
        heading: 'You have a little more time',
        lines: [
          `Ventry has resumed ticket sales for "${event.event_name}", even though the venue deadline has passed.`,
          'Please add the venue as soon as you can. Everyone with a ticket is emailed it the moment you do.',
        ],
        ctaLabel: 'Add the venue',
        ctaPath: `/organizer/events/${id}`,
        purpose: 'venue_deadline_extended',
      }).catch(err => console.error('venue extend email failed', err));
    }
  }
  return NextResponse.json({ success: true });
}
