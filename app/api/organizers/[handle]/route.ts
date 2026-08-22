import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getEventsHostedCounts } from '@/lib/server/eventsHosted';
import { ticketUrgency } from '@/lib/ticketUrgency';

type RawTier = { id: string; name: string; price: number; available: number; sold: number };

function computeBadge(tiers: RawTier[]) {
  if (!tiers?.length) return undefined;
  const totalAvailable = tiers.reduce((s, t) => s + t.available, 0);
  const totalSold = tiers.reduce((s, t) => s + t.sold, 0);
  return ticketUrgency(totalAvailable, totalSold);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeEvent(row: any, organizer: unknown) {
  const locationHidden = row.location_hidden ?? false;
  return {
    id: row.id,
    slug: row.slug,
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
    organizer,
    tiers: row.tiers ?? [],
  };
}

const EVENT_SELECT = `
  id, slug, event_name, category, description, date, time, event_mode, venue, address, city, landmark, location_hidden,
  status, total_sold, banner_color, banner_url,
  tiers:ticket_tiers(id, name, price, available, sold)
`;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle } = await params;
    const db = getServerSupabase();

    const { data: organizer, error } = await db
      .from('users')
      .select('id, name, tier, verified, member_since, bio, avatar_url, socials, handle')
      .eq('handle', handle.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('GET /api/organizers/[handle] error', error);
      return NextResponse.json({ error: 'Failed to fetch organizer' }, { status: 500 });
    }
    if (!organizer) {
      return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });
    }

    const counts = await getEventsHostedCounts(db, [organizer.id]);
    const eventsHosted = counts[organizer.id] ?? 0;

    const organizerSummary = {
      id: organizer.id,
      name: organizer.name,
      tier: organizer.tier,
      verified: organizer.verified,
      member_since: organizer.member_since,
      eventsHosted,
    };

    const { data: rows } = await db
      .from('events')
      .select(EVENT_SELECT)
      .eq('organizer_id', organizer.id)
      .eq('status', 'approved')
      .order('date', { ascending: true });

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = (rows ?? []).filter(r => r.date >= today).map(r => shapeEvent(r, organizerSummary));
    const past = (rows ?? []).filter(r => r.date < today).map(r => shapeEvent(r, organizerSummary)).reverse();

    return NextResponse.json({
      success: true,
      data: {
        organizer: {
          name: organizer.name,
          handle: organizer.handle,
          tier: organizer.tier,
          verified: organizer.verified,
          memberSince: organizer.member_since,
          bio: organizer.bio,
          avatarUrl: organizer.avatar_url,
          socials: organizer.socials ?? {},
          eventsHosted,
        },
        upcoming,
        past,
      },
    });
  } catch (err) {
    console.error('GET /api/organizers/[handle] error', err);
    return NextResponse.json({ error: 'Failed to fetch organizer' }, { status: 500 });
  }
}
