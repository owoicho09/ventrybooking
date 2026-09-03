import { getServerSupabase } from '@/lib/supabase/server';
import { sendAdminAlertEmail } from '@/lib/server/email';

type Recipient =
  | { type: 'admin' }
  | { type: 'organizer'; id: string };

interface NotifPayload {
  notifType: string;   // 'kyc' | 'event' | 'complaint' | 'purchase' | 'payout'
  title:     string;
  body:      string;
  link?:     string;
}

interface NotifOptions {
  /**
   * Admin recipients only — decides how this in-app notification also
   * reaches admin@ventrybooking.com by email:
   *  - 'dedicated' — the caller already sends (or is about to send) its own
   *    targeted email for this event elsewhere; skip the generic pipeline
   *    entirely so admin doesn't get the same thing twice.
   *  - 'immediate' — no dedicated email exists and this needs prompt action
   *    (low-volume events like a cancellation or a filed complaint) — sent
   *    right away via a plain admin-alert email.
   *  - 'digest' (default) — batched into the next hourly digest run. This
   *    is the flood-safe default for anything that could spike, e.g.
   *    webhook retries or a run of per-transaction email failures.
   */
  emailChannel?: 'dedicated' | 'immediate' | 'digest';
}

/**
 * Insert a notification row. Fire-and-forget safe — call with .catch() at
 * the caller site so a notification failure never blocks the main response.
 */
export async function notify(recipient: Recipient, payload: NotifPayload, options?: NotifOptions): Promise<void> {
  const db = getServerSupabase();
  const isAdmin = recipient.type === 'admin';
  const channel = options?.emailChannel ?? 'digest';
  // 'dedicated' and 'immediate' both mean "already handled" from the
  // digest's point of view — only a bare 'digest' row should still be
  // picked up by the next digest run.
  const handledNow = isAdmin && channel !== 'digest';

  await db.from('notifications').insert({
    recipient_type: recipient.type,
    recipient_id:   recipient.type === 'organizer' ? recipient.id : null,
    type:           payload.notifType,
    title:          payload.title,
    body:           payload.body,
    link:           payload.link ?? null,
    read:           false,
    created_at:     new Date().toISOString(),
    emailed_at:     handledNow ? new Date().toISOString() : null,
  });

  if (isAdmin && channel === 'immediate') {
    sendAdminAlertEmail({ title: payload.title, body: payload.body, link: payload.link }).catch(err =>
      console.error('notify: immediate admin email failed', err),
    );
  }
}
