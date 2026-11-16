import type { SupabaseClient } from '@supabase/supabase-js';
import { sendNewEventTeaserEmail } from '@/lib/server/email';

/**
 * Emails an organiser's Notify Me subscribers that a new event is on sale.
 *
 * Called at the moment an event actually becomes public: on admin approval
 * when it goes on sale straight away, or by the go-live cron when it was
 * scheduled for later. Sending it earlier would link subscribers to a page
 * that still 404s.
 */
export async function sendSubscriberTeasers(
  db: SupabaseClient,
  organizer: { id: string; name: string; handle: string | null } | null,
  event: { event_name: string; slug: string | null; date: string },
): Promise<void> {
  // The storefront/subscribe flow needs a handle, so no handle = no subscribers.
  if (!organizer?.id || !organizer.handle || !event.slug) return;

  const { data: subscribers } = await db
    .from('organizer_subscribers')
    .select('email, unsubscribe_token')
    .eq('organizer_id', organizer.id)
    .is('unsubscribed_at', null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  for (const sub of subscribers ?? []) {
    sendNewEventTeaserEmail({
      to: sub.email,
      organizerName: organizer.name,
      organizerHandle: organizer.handle,
      eventName: event.event_name,
      eventDate: event.date,
      eventUrl: `${appUrl}/${event.slug}`,
      unsubscribeUrl: `${appUrl}/api/subscribers/unsubscribe?token=${sub.unsubscribe_token}`,
    }).catch(err => console.error('sendNewEventTeaserEmail error', { to: sub.email, err }));
  }
}
