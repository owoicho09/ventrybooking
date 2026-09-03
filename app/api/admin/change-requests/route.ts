import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServerSupabase();
  const { data, error } = await db
    .from('event_change_requests')
    .select(`
      id, event_id, organizer_id, change_type, old_value, new_value, status, requested_at, reviewed_at, reviewed_by, rejection_reason,
      event:events!event_change_requests_event_id_fkey(event_name, slug),
      organizer:users!event_change_requests_organizer_id_fkey(name, email)
    `)
    .order('requested_at', { ascending: false });

  if (error) {
    console.error('GET /api/admin/change-requests error', error);
    return NextResponse.json({ error: 'Failed to fetch change requests' }, { status: 500 });
  }

  const rows = (data ?? []).map(r => {
    const eventRaw = r.event as { event_name: string; slug: string }[] | { event_name: string; slug: string } | null;
    const event = Array.isArray(eventRaw) ? eventRaw[0] : eventRaw;
    const orgRaw = r.organizer as { name: string; email: string }[] | { name: string; email: string } | null;
    const organizer = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
    return {
      id: r.id,
      eventId: r.event_id,
      eventName: event?.event_name ?? '',
      eventSlug: event?.slug ?? '',
      organizerName: organizer?.name ?? '',
      organizerEmail: organizer?.email ?? '',
      changeType: r.change_type,
      oldValue: r.old_value,
      newValue: r.new_value,
      status: r.status,
      requestedAt: r.requested_at,
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
      rejectionReason: r.rejection_reason,
    };
  });

  return NextResponse.json({ success: true, data: rows });
}
