import { getServerSupabase } from '@/lib/supabase/server';
import { lagosDate, nextWorkingDay, splitFee, type SettlementStatus } from '@/lib/server/settlements';

type Db = ReturnType<typeof getServerSupabase>;

// Per-event payout history, for the organiser's and the admin's payout pages.
//
// Settlements are per organiser and per sales period, so one payout can
// carry tickets from several events. Every ticket records the settlement that
// paid it (tickets.settlement_id), so each payout's actual net is shared out
// across its events in proportion to their ticket value: the per-event
// amounts always add up to exactly what was sent.

export interface EventPayoutLine {
  settlementId: string;
  /** When it was paid (or released, if not yet confirmed). */
  date: string;
  status: SettlementStatus;
  method: 'paystack' | 'manual';
  reference: string | null;
  tickets: number;
  /** This event's share of the payout's net. */
  amount: number;
  /** The payout covered more than this event. */
  shared: boolean;
}

export interface EventPayoutSummary {
  id: string;
  name: string;
  slug: string | null;
  date: string;
  status: string;
  /** Paid tickets still standing (valid or used). */
  paidTickets: number;
  freeTickets: number;
  refundedTickets: number;
  /** Ticket value of paid tickets still standing, before Ventry's fee. */
  sales: number;
  /** Net actually sent to the organiser for this event. */
  paidOut: number;
  /** Net still to come: tickets not yet in a successful payout. */
  pending: number;
  pendingTickets: number;
  /** Earliest date the pending money can be released. */
  nextPayoutOn: string | null;
  payouts: EventPayoutLine[];
}

type TicketRow = {
  id: string; event_id: string; status: string; subtotal: number | null; purchased_at: string; settlement_id: string | null;
  tier: { price: number } | { price: number }[] | null;
};
type SettlementRow = {
  id: string; kind: string; status: SettlementStatus; net: number; fee_rate: number;
  released_at: string; settled_at: string | null; payment_method: 'paystack' | 'manual' | null;
  manual_reference: string | null; transfer_reference: string | null;
};

const price = (t: TicketRow) => {
  const tier = Array.isArray(t.tier) ? t.tier[0] : t.tier;
  return Number(t.subtotal ?? tier?.price ?? 0);
};

/** Every event the organiser has (past and upcoming), with its payout history. */
export async function eventPayoutBreakdown(
  db: Db,
  organizerId: string,
  feeRate: number,
  holidays: Map<string, string>,
  onlyEventId?: string,
): Promise<EventPayoutSummary[]> {
  let eventsQ = db.from('events')
    .select('id, event_name, slug, date, status')
    .eq('organizer_id', organizerId)
    .order('date', { ascending: false });
  if (onlyEventId) eventsQ = eventsQ.eq('id', onlyEventId);

  let ticketsQ = db.from('tickets')
    .select('id, event_id, status, subtotal, purchased_at, settlement_id, tier:ticket_tiers!tickets_tier_id_fkey(price)')
    .eq('organizer_id', organizerId);
  if (onlyEventId) ticketsQ = ticketsQ.eq('event_id', onlyEventId);

  const [eventsRes, ticketsRes, settlementsRes] = await Promise.all([
    eventsQ,
    ticketsQ,
    db.from('settlements')
      .select('id, kind, status, net, fee_rate, released_at, settled_at, payment_method, manual_reference, transfer_reference')
      .eq('organizer_id', organizerId)
      .neq('status', 'void'),
  ]);
  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (ticketsRes.error) throw new Error(ticketsRes.error.message);
  if (settlementsRes.error) throw new Error(settlementsRes.error.message);

  const tickets = (ticketsRes.data ?? []) as unknown as TicketRow[];
  const settlements = new Map(((settlementsRes.data ?? []) as SettlementRow[]).map(s => [s.id, s]));

  // Each settlement's total ticket value (all its tickets, any event) is the
  // denominator for sharing its net. When filtering to one event we still
  // need the other events' tickets in those settlements.
  const settlementValue = new Map<string, number>();
  const linked = onlyEventId
    ? await (async () => {
        const ids = [...new Set(tickets.map(t => t.settlement_id).filter((x): x is string => !!x))];
        if (ids.length === 0) return [] as TicketRow[];
        const { data } = await db.from('tickets')
          .select('id, event_id, status, subtotal, purchased_at, settlement_id, tier:ticket_tiers!tickets_tier_id_fkey(price)')
          .in('settlement_id', ids);
        return (data ?? []) as unknown as TicketRow[];
      })()
    : tickets;
  for (const t of linked) {
    if (t.settlement_id) settlementValue.set(t.settlement_id, (settlementValue.get(t.settlement_id) ?? 0) + price(t));
  }

  const today = lagosDate();
  return ((eventsRes.data ?? []) as { id: string; event_name: string; slug: string | null; date: string; status: string }[]).map(ev => {
    const evTickets = tickets.filter(t => t.event_id === ev.id);
    const standing = evTickets.filter(t => t.status === 'valid' || t.status === 'used');
    const paid = standing.filter(t => price(t) > 0);

    // Group this event's tickets by the payout that carried them.
    const bySettlement = new Map<string, TicketRow[]>();
    for (const t of evTickets) {
      if (!t.settlement_id) continue;
      bySettlement.set(t.settlement_id, [...(bySettlement.get(t.settlement_id) ?? []), t]);
    }
    const payouts: EventPayoutLine[] = [];
    for (const [sid, ts] of bySettlement) {
      const s = settlements.get(sid);
      if (!s) continue;
      const value = ts.reduce((sum, t) => sum + price(t), 0);
      const total = settlementValue.get(sid) ?? value;
      const amount = total > 0 ? Math.round(Number(s.net) * (value / total)) : 0;
      payouts.push({
        settlementId: sid,
        date: s.settled_at ?? s.released_at,
        status: s.status,
        method: s.payment_method === 'manual' ? 'manual' : 'paystack',
        reference: s.payment_method === 'manual' ? s.manual_reference : s.transfer_reference,
        tickets: ts.length,
        amount,
        shared: total - value > 0.5,
      });
    }
    payouts.sort((a, b) => b.date.localeCompare(a.date));

    // Pending: standing paid tickets not in a successful payout (unsettled,
    // or in one still in flight / failed).
    const unpaid = paid.filter(t => !t.settlement_id || settlements.get(t.settlement_id)?.status !== 'successful');
    const pendingValue = unpaid.reduce((s, t) => s + price(t), 0);
    const unclaimed = unpaid.filter(t => !t.settlement_id);
    const earliestSale = unclaimed.map(t => lagosDate(new Date(t.purchased_at))).sort()[0];
    let nextPayoutOn: string | null = null;
    if (earliestSale) {
      const on = nextWorkingDay(earliestSale, holidays);
      nextPayoutOn = on < today ? today : on;
    }

    return {
      id: ev.id,
      name: ev.event_name?.trim() || 'Untitled event',
      slug: ev.slug,
      date: String(ev.date).slice(0, 10),
      status: ev.status,
      paidTickets: paid.length,
      freeTickets: standing.length - paid.length,
      refundedTickets: evTickets.filter(t => t.status === 'refunded').length,
      sales: paid.reduce((s, t) => s + price(t), 0),
      paidOut: payouts.filter(p => p.status === 'successful').reduce((s, p) => s + p.amount, 0),
      pending: splitFee(pendingValue, feeRate).net,
      pendingTickets: unpaid.length,
      nextPayoutOn,
      payouts,
    };
  });
}
