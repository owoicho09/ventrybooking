import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getEventsHostedCounts } from '@/lib/server/eventsHosted';
import { isUUID } from '@/lib/slug';

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

    // Accepts either the event's UUID (legacy links, internal dashboards) or
    // its slug (canonical public URL). Postgres errors on a non-UUID value
    // passed to a UUID column equality check, so branch instead of blindly
    // querying both.
    let qb = db
      .from('events')
      .select(`
        id, slug, event_name, category, description, date, time, event_mode, venue, address, city, landmark, location_hidden,
        status, total_sold, banner_color, banner_url, accent_color, lineup,
        organizer:users!events_organizer_id_fkey(id, name, tier, verified, member_since, events_hosted, handle),
        tiers:ticket_tiers(id, name, price, available, sold)
      `);
    qb = isUUID(id) ? qb.eq('id', id) : qb.eq('slug', id);
    const { data, error } = await qb.maybeSingle();

    if (error) {
      console.error('GET /api/events/[id] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const tiers = (data.tiers as RawTier[]) ?? [];
    const locationHidden = data.location_hidden ?? false;

    // Supabase's untyped client infers to-one embedded resources loosely; normalize
    // in case it comes back as a single-element array rather than an object.
    const rawOrganizer = data.organizer as unknown;
    const organizer = (Array.isArray(rawOrganizer) ? rawOrganizer[0] : rawOrganizer) as
      ({ id: string; events_hosted: number } & Record<string, unknown>) | null;
    if (organizer) {
      const counts = await getEventsHostedCounts(db, [organizer.id]);
      organizer.events_hosted = counts[organizer.id] ?? 0;
    }

    const event = {
      id: data.id,
      slug: data.slug,
      name: data.event_name,
      category: data.category,
      description: data.description,
      date: data.date,
      time: data.time,
      event_mode: data.event_mode ?? 'physical',
      venue: locationHidden ? 'Exact location undisclosed' : data.venue,
      address: locationHidden ? '' : data.address,
      city: data.city,
      landmark: data.landmark ?? null,
      location_hidden: locationHidden,
      locationHidden: locationHidden,
      status: data.status,
      bannerColor: data.banner_color,
      banner_url: data.banner_url ?? null,
      accentColor: data.accent_color ?? null,
      lineup: data.lineup ?? [],
      totalSold: data.total_sold,
      badge: computeBadge(tiers),
      organizer,
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
