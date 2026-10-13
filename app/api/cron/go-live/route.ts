import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendEventWentLiveEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';
import { fmtGoLive } from '@/lib/goLive';

// Scheduled go-live: tells organisers their event just went on sale.
//
// The event itself goes public on its own the moment goes_live_at passes
// (every public query checks it), so this job is only the announcement.
// Schedule (external cron, like the other jobs): every 5 minutes.
// `?dryRun=1` lists what would be sent without sending.
//
// Each event is claimed by setting live_notified_at *before* the email goes
// out, so overlapping runs can't email an organiser twice.

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServerSupabase();
  const now = new Date().toISOString();

  const { data: due, error } = await db
    .from('events')
    .select('id, event_name, slug, goes_live_at, organizer:users!events_organizer_id_fkey(id, name, email)')
    .eq('status', 'approved')
    .not('goes_live_at', 'is', null)
    .lte('goes_live_at', now)
    .is('live_notified_at', null)
    .limit(50);
  if (error) {
    console.error('cron go-live query error', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  if (req.nextUrl.searchParams.get('dryRun') === '1') {
    return NextResponse.json({ success: true, dryRun: true, due: (due ?? []).map(e => ({ id: e.id, event: e.event_name, goesLiveAt: e.goes_live_at })) });
  }

  let sent = 0;
  for (const e of due ?? []) {
    const { data: claimed } = await db
      .from('events')
      .update({ live_notified_at: new Date().toISOString() })
      .eq('id', e.id)
      .is('live_notified_at', null)
      .select('id');
    if (!claimed?.length) continue;

    const org = (Array.isArray(e.organizer) ? e.organizer[0] : e.organizer) as { id: string; name: string; email: string } | null;
    const liveAt = fmtGoLive(e.goes_live_at as string);
    if (org?.email && e.slug) {
      try {
        await sendEventWentLiveEmail({ to: org.email, organizerName: org.name || 'there', eventName: e.event_name, eventSlug: e.slug, liveAt });
        sent++;
      } catch (err) {
        console.error('cron go-live email error', { eventId: e.id, err });
      }
    }
    if (org?.id) {
      await notify(
        { type: 'organizer', id: org.id },
        { notifType: 'event', title: 'Your event is live', body: `"${e.event_name}" is now on sale.`, link: '/organizer/events' },
      ).catch(err => console.error('cron go-live notify error', err));
    }
  }

  return NextResponse.json({ success: true, due: due?.length ?? 0, sent });
}
