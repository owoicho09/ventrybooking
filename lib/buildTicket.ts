import type { Ticket } from '@/types';

// Maps a raw /api/tickets/[id]-shaped row (or the buyer/organizer variants of
// the same shape) into the Ticket type TicketCard expects. Shared by every
// page that lists tickets from that API shape (order confirmation, buyer
// account "My Tickets") so they can't drift apart.
export function buildTicket(raw: Record<string, unknown>): Ticket {
  const event = raw.event as Record<string, unknown> | null;
  const tier  = raw.tier  as Record<string, unknown> | null;
  return {
    id:          raw.id as string,
    eventId:     (event?.id as string) || '',
    event: {
      ...(event as object),
      name:        (event?.event_name as string) || (event?.name as string) || '',
      organizer:   (event?.organizer as object) || {},
      tiers:       [],
      status:      'approved' as const,
      totalSold:   0,
      bannerColor: (event?.banner_color as string) || 'from-purple-900 to-indigo-900',
    } as unknown as Ticket['event'],
    tier:         (tier as unknown as Ticket['tier']) || {} as unknown as Ticket['tier'],
    quantity:     (raw.quantity as number) ?? 1,
    buyerName:    raw.buyer_name as string,
    buyerEmail:   raw.buyer_email as string,
    totalPaid:    raw.total_paid as number,
    status:       raw.status as Ticket['status'],
    purchasedAt:  raw.purchased_at as string,
    refundCode:   raw.refund_code as string,
    qrData:       (raw.qr_token as string) || (raw.id as string),
    qrDataUrl:    raw.qrDataUrl as string | null,
    purchasedByMe: raw.purchasedByMe as boolean | undefined,
  };
}
