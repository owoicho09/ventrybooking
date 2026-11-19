import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Event ids an admin chose for the homepage hero deck (063), slot order
 * (first = card on top). Any failure returns [] so the homepage falls back
 * to the automatic deck rather than breaking.
 */
export async function getHeroSlotIds(): Promise<string[]> {
  try {
    const { data, error } = await getServerSupabase()
      .from('homepage_hero')
      .select('slot, event_id')
      .order('slot');
    if (error) return [];
    return (data ?? []).map(r => r.event_id).filter((id): id is string => !!id);
  } catch {
    return [];
  }
}
