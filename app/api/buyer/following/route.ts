import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getBuyerAuth } from '@/lib/server/buyerAuth';

export async function GET() {
  const buyer = await getBuyerAuth();
  if (!buyer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const db = getServerSupabase();
  const { data, error } = await db
    .from('organizer_subscribers')
    .select('organizer:users!organizer_subscribers_organizer_id_fkey(id, name, handle, avatar_url, verified, tier)')
    .eq('email', buyer.email)
    .eq('source', 'follow')
    .is('unsubscribed_at', null);

  if (error) {
    console.error('GET /api/buyer/following error:', error);
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 });
  }

  type OrgRow = { id: string; name: string; handle: string | null; avatar_url: string | null; verified: boolean; tier: string };
  const one = <T,>(v: T[] | T | null | undefined): T | null => (v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v);
  const organizers = (data ?? [])
    .map(row => one(row.organizer as OrgRow[] | OrgRow | null))
    .filter((o): o is OrgRow => !!o);

  return NextResponse.json({ success: true, data: organizers });
}
