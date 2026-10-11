import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// Ventry's own newsletter list (ventry_subscribers): everyone who ticked the
// marketing box at checkout, including the consents merged in from before the
// single checkbox. Organisers' Audiences are separate and not listed here.
// Returns every row; the admin page searches and filters client-side.

const PAGE = 1000;

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServerSupabase();
  try {
    const rows: { id: string; email: string; name: string | null; event_name: string | null; subscribed_at: string; unsubscribed_at: string | null }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from('ventry_subscribers')
        .select('id, email, name, subscribed_at, unsubscribed_at, event:events(event_name)')
        .order('subscribed_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const r of data ?? []) {
        const ev = Array.isArray(r.event) ? r.event[0] : r.event;
        rows.push({
          id: r.id,
          email: r.email,
          name: r.name ?? null,
          event_name: (ev as { event_name: string } | null)?.event_name ?? null,
          subscribed_at: r.subscribed_at,
          unsubscribed_at: r.unsubscribed_at ?? null,
        });
      }
      if (!data || data.length < PAGE) break;
    }
    return NextResponse.json({ success: true, data: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/admin/subscribers error', err);
    return NextResponse.json({ error: 'Failed to load subscribers' }, { status: 500 });
  }
}
