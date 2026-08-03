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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeEvent(row: any) {
  const locationHidden = row.location_hidden ?? false;
  return {
    id: row.id,
    name: row.event_name,
    category: row.category,
    description: row.description,
    date: row.date,
    time: row.time,
    event_mode: row.event_mode ?? 'physical',
    venue: locationHidden ? 'Exact location undisclosed' : row.venue,
    address: locationHidden ? '' : row.address,
    city: row.city,
    landmark: row.landmark ?? null,
    location_hidden: locationHidden,
    locationHidden: locationHidden,
    status: row.status,
    bannerColor: row.banner_color,
    banner_url: row.banner_url ?? null,
    totalSold: row.total_sold,
    badge: computeBadge(row.tiers ?? []),
    organizer: row.organizer,
    tiers: row.tiers ?? [],
  };
}

const EVENT_SELECT = `
  id, event_name, category, description, date, time, event_mode, venue, address, city, landmark, location_hidden,
  status, total_sold, banner_color, banner_url,
  organizer:users!events_organizer_id_fkey(id, name, tier, verified, member_since, events_hosted),
  tiers:ticket_tiers(id, name, price, available, sold)
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const city = searchParams.get('city') || '';
    const mode = searchParams.get('mode') || '';
    const limit = parseInt(searchParams.get('limit') || '0', 10);

    const db = getServerSupabase();
    let qb = db
      .from('events')
      .select(EVENT_SELECT)
      .eq('status', 'approved')
      .order('date', { ascending: true });

    if (query) {
      qb = qb.or(`event_name.ilike.%${query}%,city.ilike.%${query}%,venue.ilike.%${query}%`);
    }
    if (category) {
      qb = qb.eq('category', category);
    }
    if (mode === 'online') {
      qb = qb.eq('event_mode', 'online');
    } else if (city) {
      qb = qb.ilike('city', `%${city}%`);
    }
    if (limit > 0) {
      qb = qb.limit(limit);
    }

    const { data, error } = await qb;
    if (error) throw error;

    return NextResponse.json(
      { success: true, data: (data ?? []).map(shapeEvent) },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    );
  } catch (err) {
    console.error('GET /api/events error', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
