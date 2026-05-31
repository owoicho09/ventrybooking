import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const eventId = searchParams.get('eventId');

  const db = getServerSupabase();

  // Fetch logs and event capacity in parallel
  const logsQuery = db
    .from('scan_logs')
    .select('id, ticket_id, attendee_name, ticket_type, scanned_at, result')
    .order('scanned_at', { ascending: false })
    .limit(50);

  const [logsRes, capacityRes] = await Promise.all([
    eventId ? logsQuery.eq('event_id', eventId) : logsQuery.eq('scanned_by', user.sub),
    eventId
      ? db.from('ticket_tiers').select('available, sold').eq('event_id', eventId)
      : Promise.resolve({ data: null as null | { available: number; sold: number }[], error: null }),
  ]);

  if (logsRes.error) {
    return NextResponse.json({ error: 'Failed to fetch scan logs' }, { status: 500 });
  }

  const logs     = logsRes.data  || [];
  const scanned  = logs.filter(l => l.result === 'success').length;
  const rejected = logs.filter(l => l.result !== 'success').length;

  let remaining = 0;
  if (capacityRes.data) {
    const totalCapacity = capacityRes.data.reduce((s, t) => s + t.available, 0);
    const totalSold     = capacityRes.data.reduce((s, t) => s + t.sold, 0);
    remaining = Math.max(0, totalCapacity - totalSold);
  }

  return NextResponse.json({
    success: true,
    data: { logs, stats: { scanned, rejected, remaining } },
  });
}
