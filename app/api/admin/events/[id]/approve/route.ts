import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendEventApprovedEmail, sendNewEventTeaserEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';

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
      .select('event_name, slug, date, organizer:users!events_organizer_id_fkey(id, name, email, handle)')
      .eq('id', id)
      .single();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    await db.from('events').update({ status: 'approved' }).eq('id', id);

    const organizerRaw = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
    const organizer = organizerRaw as { id: string; name: string; email: string; handle: string | null } | null;
    if (organizer?.email) {
      await sendEventApprovedEmail(organizer.email, organizer.name, event.event_name, event.slug).catch(console.error);
    }
    if (organizer?.id) {
      notify(
        { type: 'organizer', id: organizer.id },
        { notifType: 'event', title: 'Event Approved', body: `"${event.event_name}" is now live and accepting ticket sales.`, link: `/organizer/events` },
      ).catch(console.error);
    }

    // Teaser to this organiser's Notify Me subscribers. Only meaningful once
    // they have a handle (the storefront/subscribe flow requires one) — an
    // organiser with no handle simply has no subscribers to notify.
    if (organizer?.id && organizer.handle && event.slug) {
      const { data: subscribers } = await db
        .from('organizer_subscribers')
        .select('email, unsubscribe_token')
        .eq('organizer_id', organizer.id)
        .is('unsubscribed_at', null);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
      for (const sub of subscribers ?? []) {
        sendNewEventTeaserEmail({
          to: sub.email,
          organizerName: organizer.name,
          organizerHandle: organizer.handle,
          eventName: event.event_name,
          eventDate: event.date,
          eventUrl: `${appUrl}/${event.slug}`,
          unsubscribeUrl: `${appUrl}/api/subscribers/unsubscribe?token=${sub.unsubscribe_token}`,
        }).catch(err => console.error('sendNewEventTeaserEmail error', { to: sub.email, err }));
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('approve event error', err);
    return NextResponse.json({ error: 'Failed to approve event' }, { status: 500 });
  }
}
