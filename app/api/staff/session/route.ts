import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

// Validates a staff code and writes an HttpOnly cookie so that subsequent
// ticket scans opened by the iOS Camera app (SFSafariViewController) are
// authenticated automatically — no localStorage, no client state.
export async function POST(req: NextRequest) {
  const { code } = await req.json() as { code?: string };
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

  const db = getServerSupabase();
  const { data } = await db
    .from('staff_ids')
    .select(`
      code, active, expires_at, label,
      event:events!staff_ids_event_id_fkey(id, event_name)
    `)
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();

  if (!data)        return NextResponse.json({ error: 'Invalid staff code' },              { status: 401 });
  if (!data.active) return NextResponse.json({ error: 'This staff ID has been deactivated' }, { status: 401 });
  if (new Date() > new Date(data.expires_at)) {
    return NextResponse.json({ error: 'This staff ID has expired' }, { status: 401 });
  }

  const eventRow = Array.isArray(data.event)
    ? data.event[0]
    : (data.event as { id: string; event_name: string } | null);

  const maxAge = Math.max(
    Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000),
    0,
  );

  const res = NextResponse.json({
    success:   true,
    code:      data.code,
    label:     data.label,
    eventId:   eventRow?.id,
    eventName: eventRow?.event_name,
    expiresAt: data.expires_at,
  });

  // SameSite=Lax: sent on top-level navigations (iOS Camera opening a URL) AND
  // on same-site fetch requests (the scan API call from within the page).
  res.cookies.set('ventry_staff', data.code, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge,
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete('ventry_staff');
  return res;
}
