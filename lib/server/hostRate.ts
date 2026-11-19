import type { getServerSupabase } from '@/lib/supabase/server';
import { PLATFORM_FEE_RATE } from '@/lib/fees';

type Db = ReturnType<typeof getServerSupabase>;

/**
 * The host share of Ventry's fee for an event (062): the event's own rate
 * from its fee split, or the organiser's account rate for events created
 * before fee splits existed.
 */
export async function eventHostRate(db: Db, eventId: string, organizerId: string): Promise<number> {
  const [{ data: ev }, { data: org }] = await Promise.all([
    db.from('events').select('host_fee_rate').eq('id', eventId).maybeSingle(),
    db.from('users').select('platform_fee_rate').eq('id', organizerId).maybeSingle(),
  ]);
  if (ev?.host_fee_rate != null) return Number(ev.host_fee_rate);
  return org?.platform_fee_rate == null ? PLATFORM_FEE_RATE : Number(org.platform_fee_rate);
}
