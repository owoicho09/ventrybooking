import { getServerSupabase } from '@/lib/supabase/server';

type Db = ReturnType<typeof getServerSupabase>;

/**
 * Records checkout marketing consent. Checkout has one box that covers both
 * lists; the two flags stay separate here because each list has its own row
 * and its own unsubscribe token, so leaving one never touches the other.
 * Never adds anyone to a list they didn't consent to. Errors are logged,
 * not thrown — a consent write must never fail a paid order.
 */
export async function recordCheckoutConsent(
  db: Db,
  p: {
    organizerId: string;
    eventId: string;
    email: string;
    name: string | null;
    organizer: boolean;
    ventry: boolean;
  },
): Promise<void> {
  const email = p.email.trim().toLowerCase();
  if (!email) return;
  const name = p.name?.trim() || null;

  await Promise.all([
    p.organizer
      ? db.rpc('upsert_audience_member', {
          p_organizer_id: p.organizerId,
          p_email:        email,
          p_name:         name,
          p_phone:        null,
          p_source:       'ticket_consent',
          p_event_id:     p.eventId,
        }).then(({ error }) => { if (error) console.error('recordCheckoutConsent: audience upsert error', error); })
      : null,
    p.ventry
      ? db.rpc('upsert_ventry_subscriber', {
          p_email:    email,
          p_name:     name,
          p_event_id: p.eventId,
        }).then(({ error }) => { if (error) console.error('recordCheckoutConsent: ventry list upsert error', error); })
      : null,
  ]).catch(err => console.error('recordCheckoutConsent error', err));
}

/**
 * Unsubscribe link for a Ventry-list email. Any future Ventry-level mailing
 * must include it; it only ever removes the person from Ventry's list, never
 * from an organiser's Audience.
 */
export function ventryUnsubscribeUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ventrybooking.com';
  return `${appUrl}/api/subscribers/unsubscribe?token=${encodeURIComponent(token)}`;
}
