import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// GET — full moderation queue: every submitted mail with full preview
// content (subject, body, images) and the organiser's current audience size.
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');

  const db = getServerSupabase();
  let qb = db
    .from('newsletters')
    .select('id, subject, body, image_urls, status, rejection_reason, recipient_count, submitted_at, reviewed_at, sent_at, organizer:users!newsletters_organizer_id_fkey(id, name)')
    .order('submitted_at', { ascending: false });

  if (status) qb = qb.eq('status', status);

  const { data, error } = await qb;
  if (error) {
    console.error('GET /api/admin/newsletters error', error);
    return NextResponse.json({ error: 'Failed to fetch newsletters' }, { status: 500 });
  }

  const rows = data ?? [];
  const organizerIds = Array.from(new Set(rows.map(r => {
    const org = Array.isArray(r.organizer) ? r.organizer[0] : r.organizer;
    return (org as { id: string } | null)?.id;
  }).filter(Boolean))) as string[];

  let audienceCounts = new Map<string, number>();
  if (organizerIds.length > 0) {
    const { data: counts } = await db.rpc('get_audience_counts', { organizer_ids: organizerIds });
    audienceCounts = new Map((counts ?? []).map((c: { organizer_id: string; member_count: number }) => [c.organizer_id, c.member_count]));
  }

  const mapped = rows.map(r => {
    const org = Array.isArray(r.organizer) ? r.organizer[0] : r.organizer;
    const orgTyped = org as { id: string; name: string } | null;
    return {
      id:               r.id,
      subject:          r.subject,
      body:             r.body,
      image_urls:       r.image_urls,
      status:           r.status,
      rejection_reason: r.rejection_reason,
      recipient_count:  r.recipient_count,
      submitted_at:     r.submitted_at,
      reviewed_at:      r.reviewed_at,
      sent_at:          r.sent_at,
      organizer_name:   orgTyped?.name ?? 'Unknown',
      audience_size:    orgTyped ? (audienceCounts.get(orgTyped.id) ?? 0) : 0,
    };
  });

  return NextResponse.json({ success: true, data: mapped });
}
