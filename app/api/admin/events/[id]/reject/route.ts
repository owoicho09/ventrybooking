import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendEventRejectedEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';

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
    const { reason } = await req.json();
    if (!reason) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });

    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('event_name, organizer:users!events_organizer_id_fkey(id, name, email)')
      .eq('id', id)
      .single();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // Delete the event — ticket_tiers cascade automatically.
    // Rejected events are always under_review (never published), so no tickets exist.
    const { error: deleteErr } = await db.from('events').delete().eq('id', id);
    if (deleteErr) return NextResponse.json({ error: 'Failed to reject event' }, { status: 500 });

    const organizerRaw = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
    const organizer = organizerRaw as { id: string; name: string; email: string } | null;
    if (organizer?.email) {
      await sendEventRejectedEmail(organizer.email, organizer.name, event.event_name, reason).catch(console.error);
    }
    if (organizer?.id) {
      notify(
        { type: 'organizer', id: organizer.id },
        { notifType: 'event', title: 'Event Not Approved', body: `"${event.event_name}" was not approved: ${reason}`, link: '/organizer/events' },
      ).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('reject event error', err);
    return NextResponse.json({ error: 'Failed to reject event' }, { status: 500 });
  }
}
