import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUUID } from '@/lib/slug';
import { EventDetailContent } from '@/components/events/EventDetailContent';
import { OrganizerStorefront } from '@/components/organizer/OrganizerStorefront';

// Events and organiser storefronts share one flat namespace at the top
// level (ventrybooking.com/wildout for an event, ventrybooking.com/bryanmoore
// for an organiser) — no "@" or other prefix. A leading "@" was tried first,
// but Next.js's App Router reserves "@" for parallel-route folder naming,
// and that reservation leaks into dynamic segment *values* too: a request
// to /@handle arrived with params.slug still percent-encoded ("%40handle"),
// never decoded, so it 404'd no matter what. Slug generation and handle
// validation both check both `events.slug` and `users.handle` for
// collisions (see lib/server/slug.ts and the settings route) so the two
// can never collide in this shared namespace.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getEventBySlug(slug: string) {
  const db = getServerSupabase();
  const { data } = await db
    .from('events')
    .select('event_name, description, banner_url, status, updated_at')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

async function getOrganizerByHandle(handle: string) {
  const db = getServerSupabase();
  const { data } = await db
    .from('users')
    .select('name, bio')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (isUUID(slug)) return {};

  const event = await getEventBySlug(slug);
  if (event) {
    // Cache-busting query param: WhatsApp/Slack/Twitter cache link previews
    // per-URL, so a flyer or title edit needs the image URL itself to
    // change, not just its underlying content, or crawlers keep serving
    // the stale one.
    const cacheKey = event.updated_at ? new Date(event.updated_at).getTime() : 0;
    const ogImageUrl = `/${slug}/opengraph-image?v=${cacheKey}`;

    return {
      title: `${event.event_name} — Ventry`,
      description: event.description?.slice(0, 160),
      openGraph: {
        title: event.event_name,
        description: event.description?.slice(0, 160),
        url: `/${slug}`,
        type: 'website',
        images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: event.event_name,
        description: event.description?.slice(0, 160),
        images: [ogImageUrl],
      },
    };
  }

  const organizer = await getOrganizerByHandle(slug);
  if (organizer) {
    const description = organizer.bio?.slice(0, 160) || `${organizer.name}'s events on Ventry.`;
    const ogImageUrl = `/${slug}/opengraph-image`;
    return {
      title: `${organizer.name} — Ventry`,
      description,
      openGraph: {
        title: organizer.name,
        description,
        url: `/${slug}`,
        type: 'website',
        images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: organizer.name,
        description,
        images: [ogImageUrl],
      },
    };
  }

  return {};
}

export default async function SlugRoute({ params }: PageProps) {
  const { slug } = await params;

  if (isUUID(slug)) {
    // Defensive fallback: a raw UUID hit the bare top-level route directly
    // (e.g. an old link that skipped the /events/[id] shim). Let that shim
    // do the canonical id -> slug lookup and redirect.
    redirect(`/events/${slug}`);
  }

  const event = await getEventBySlug(slug);
  if (event) {
    if (event.status !== 'approved') notFound();
    return <EventDetailContent identifier={slug} />;
  }

  const organizer = await getOrganizerByHandle(slug);
  if (organizer) {
    return <OrganizerStorefront handle={slug.toLowerCase()} />;
  }

  notFound();
}
