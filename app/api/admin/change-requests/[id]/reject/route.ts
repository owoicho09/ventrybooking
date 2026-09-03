import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendChangeRequestDecisionEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { reason } = await req.json().catch(() => ({}));
  const db = getServerSupabase();

  const { data: request } = await db
    .from('event_change_requests')
    .select('id, event_id, organizer_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!request) return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'This request has already been reviewed' }, { status: 400 });
  }

  const { error } = await db
    .from('event_change_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.email,
      rejection_reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
    })
    .eq('id', id);

  if (error) {
    console.error('reject change request error', error);
    return NextResponse.json({ error: 'Failed to reject the request' }, { status: 500 });
  }

  const { data: event } = await db.from('events').select('event_name').eq('id', request.event_id).maybeSingle();
  const { data: organizer } = await db.from('users').select('name, email').eq('id', request.organizer_id).maybeSingle();

  if (organizer && event) {
    sendChangeRequestDecisionEmail({
      to: organizer.email,
      organizerName: organizer.name,
      eventName: event.event_name,
      approved: false,
      rejectionReason: typeof reason === 'string' ? reason.trim() : null,
    }).catch(err => console.error('sendChangeRequestDecisionEmail error', err));
  }

  notify(
    { type: 'organizer', id: request.organizer_id },
    {
      notifType: 'event_change_request',
      title: `Change not approved — ${event?.event_name ?? ''}`,
      body: 'Your requested venue/date change was not approved.',
      link: '/organizer/dashboard',
    },
  ).catch(console.error);

  return NextResponse.json({ success: true });
}
