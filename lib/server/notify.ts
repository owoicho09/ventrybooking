import { getServerSupabase } from '@/lib/supabase/server';

type Recipient =
  | { type: 'admin' }
  | { type: 'organizer'; id: string };

interface NotifPayload {
  notifType: string;   // 'kyc' | 'event' | 'complaint' | 'purchase' | 'payout'
  title:     string;
  body:      string;
  link?:     string;
}

/**
 * Insert a notification row. Fire-and-forget safe — call with .catch() at
 * the caller site so a notification failure never blocks the main response.
 */
export async function notify(recipient: Recipient, payload: NotifPayload): Promise<void> {
  const db = getServerSupabase();
  await db.from('notifications').insert({
    recipient_type: recipient.type,
    recipient_id:   recipient.type === 'organizer' ? recipient.id : null,
    type:           payload.notifType,
    title:          payload.title,
    body:           payload.body,
    link:           payload.link ?? null,
    read:           false,
    created_at:     new Date().toISOString(),
  });
}
