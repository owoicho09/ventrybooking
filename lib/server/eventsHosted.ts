import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * users.events_hosted is dead — set to 0 at registration and never
 * incremented (nothing transitions an event to status='completed'). This
 * computes the real count live via the get_events_hosted_counts RPC,
 * batched across organizers to avoid N+1 queries on list pages.
 */
export async function getEventsHostedCounts(
  db: SupabaseClient,
  organizerIds: string[],
): Promise<Record<string, number>> {
  const uniqueIds = [...new Set(organizerIds)];
  if (uniqueIds.length === 0) return {};

  const { data, error } = await db.rpc('get_events_hosted_counts', { organizer_ids: uniqueIds });
  if (error) {
    console.error('getEventsHostedCounts: rpc error', error);
    return {};
  }
  return Object.fromEntries(
    (data ?? []).map((row: { organizer_id: string; hosted_count: number }) => [row.organizer_id, row.hosted_count])
  );
}
