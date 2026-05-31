import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Public endpoint — no organizer session required.
 * Validates a staff code and returns enough information for the client to store
 * a local session (eventId + expiry) so subsequent scans authenticate silently.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code')?.trim().toUpperCase();

  if (!code) return NextResponse.json({ valid: false, error: 'Code required' }, { status: 400 });

  const db = getServerSupabase();
  const { data } = await db
    .from('staff_ids')
    .select(`
      code, active, expires_at, label,
      event:events!staff_ids_event_id_fkey(id, event_name, date)
    `)
    .eq('code', code)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ valid: false, error: 'Invalid staff code' });
  }
  if (!data.active) {
    return NextResponse.json({ valid: false, error: 'This staff ID has been deactivated' });
  }
  if (new Date() > new Date(data.expires_at)) {
    return NextResponse.json({ valid: false, error: 'This staff ID has expired' });
  }

  const eventRow = Array.isArray(data.event) ? data.event[0] : data.event as { id: string; event_name: string } | null;

  return NextResponse.json({
    valid:      true,
    code:       data.code,
    label:      data.label,
    expiresAt:  data.expires_at,
    eventId:    eventRow?.id,
    eventName:  eventRow?.event_name,
  });
}
