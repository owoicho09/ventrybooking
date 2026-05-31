import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

type RawTier = { id: string; name: string; price: number; available: number; sold: number };

function computeBadge(tiers: RawTier[]) {
  if (!tiers?.length) return undefined;
  const totalAvailable = tiers.reduce((s, t) => s + t.available, 0);
  const totalSold = tiers.reduce((s, t) => s + t.sold, 0);
  const remaining = totalAvailable - totalSold;
  if (remaining === 0) return 'sold_out' as const;
  if (totalAvailable > 0 && remaining / totalAvailable <= 0.2) return 'limited' as const;
  if (totalAvailable > 0 && totalSold / totalAvailable >= 0.5) return 'selling_fast' as const;
  return undefined;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const db = getServerSupabase();

    const { data, error } = await db
      .from('events')
      .select(`
        id, event_name, category, description, date, time, venue, address, city,
        status, total_sold, banner_color, banner_url,
        organizer:users!events_organizer_id_fkey(id, name, tier, verified, member_since, events_hosted),
        tiers:ticket_tiers(id, name, price, available, sold)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('GET /api/events/[id] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const tiers = (data.tiers as RawTier[]) ?? [];
    const event = {
      id: data.id,
      name: data.event_name,
      category: data.category,
      description: data.description,
      date: data.date,
      time: data.time,
      venue: data.venue,
      address: data.address,
      city: data.city,
      status: data.status,
      bannerColor: data.banner_color,
      banner_url: data.banner_url ?? null,
      totalSold: data.total_sold,
      badge: computeBadge(tiers),
      organizer: data.organizer,
      tiers,
    };

    return NextResponse.json(
      { success: true, data: event },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    );
  } catch (err) {
    console.error('GET /api/events/[id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}
