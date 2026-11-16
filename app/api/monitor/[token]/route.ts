import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { buildMonitorSnapshot } from '@/lib/server/monitor';

/**
 * Public, read-only event performance for a sponsor monitor link (056).
 * No login: the token in the link is the key. A switched-off or unknown
 * link gets the same answer, so tokens can't be probed.
 * `?view=1` (sent once when the page opens, not on auto-refresh) counts a view.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!checkRateLimit(`monitor:${getIp(req.headers)}`, 120, 60)) {
    return NextResponse.json({ error: 'Too many requests. Slow down a little.' }, { status: 429 });
  }
  const inactive = NextResponse.json({ error: 'This monitoring link isn’t active. Ask the organiser for a new one.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!/^[a-f0-9]{64}$/.test(token)) return inactive;

  const db = getServerSupabase();
  const { data: link } = await db
    .from('monitor_links')
    .select('id, event_id, label, active, view_count')
    .eq('token', token)
    .maybeSingle();
  if (!link || !link.active) return inactive;

  try {
    const snapshot = await buildMonitorSnapshot(db, link.event_id, link.label);
    if (!snapshot) return inactive;

    if (req.nextUrl.searchParams.get('view') === '1') {
      db.from('monitor_links')
        .update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
        .eq('id', link.id)
        .then(({ error }) => { if (error) console.error('monitor view count error', error.message); });
    }

    return NextResponse.json({ success: true, data: snapshot }, {
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  } catch (err) {
    console.error('GET /api/monitor/[token] error', err);
    return NextResponse.json({ error: 'Could not load the figures. Try again shortly.' }, { status: 500 });
  }
}
