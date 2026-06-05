import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendEventApprovedEmail } from '@/lib/server/email';
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
      .select('event_name, organizer:users!events_organizer_id_fkey(id, name, email)')
      .eq('id', id)
      .single();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    await db.from('events').update({ status: 'approved' }).eq('id', id);

    const organizerRaw = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
    const organizer = organizerRaw as { id: string; name: string; email: string } | null;
    if (organizer?.email) {
      await sendEventApprovedEmail(organizer.email, organizer.name, event.event_name, id).catch(console.error);
    }
    if (organizer?.id) {
      notify(
        { type: 'organizer', id: organizer.id },
        { notifType: 'event', title: 'Event Approved', body: `"${event.event_name}" is now live and accepting ticket sales.`, link: `/organizer/events` },
      ).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('approve event error', err);
    return NextResponse.json({ error: 'Failed to approve event' }, { status: 500 });
  }
}
