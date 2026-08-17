import { notFound, permanentRedirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { EventDetailContent } from '@/components/events/EventDetailContent';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Legacy UUID URL shim. The canonical public URL is now the bare slug route
// at app/[slug]/page.tsx — this only exists so links already shared on
// WhatsApp/social under /events/{uuid} keep working, permanently redirected
// to the new slug URL (preserving query params like ?ref= for affiliate
// tracking).
export default async function LegacyEventRedirect({ params, searchParams }: PageProps) {
  const { id } = await params;
  const db = getServerSupabase();

  const { data: event } = await db
    .from('events')
    .select('slug')
    .eq('id', id)
    .maybeSingle();

  if (!event) notFound();

  if (!event.slug) {
    // Defensive: should never happen post-backfill, but avoid redirecting
    // into a dead /undefined URL if it somehow does.
    return <EventDetailContent identifier={id} />;
  }

  const qs = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(qs)) {
    if (typeof value === 'string') query.set(key, value);
  }
  const suffix = query.toString();

  permanentRedirect(`/${event.slug}${suffix ? `?${suffix}` : ''}`);
}
