// Paused ticket sales (061). The event page stays up for ticket holders;
// only checkout stops. Shared by checkout, the public event API and the
// organiser/admin screens.

export type SalesPauseReason = 'cancel_requested' | 'venue_missing';

export function isSalesPaused(reason: string | null | undefined): reason is SalesPauseReason {
  return reason === 'cancel_requested' || reason === 'venue_missing';
}

/** What a buyer is told when they can't check out. */
export function salesPausedMessage(reason: string | null | undefined): string {
  return reason === 'venue_missing'
    ? 'Ticket sales are paused until the organiser confirms the venue.'
    : 'Ticket sales for this event are paused.';
}
