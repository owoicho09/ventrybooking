export type UrgencyLevel = 'few_left' | 'very_few_left' | 'almost_gone' | 'sold_out';

export const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  few_left:      'Few left',
  very_few_left: 'Very few left',
  almost_gone:   'Almost gone',
  sold_out:      'Sold out',
};

/**
 * Scarcity messaging only kicks in once a tier (or a whole event, summed
 * across its tiers) is both 70%+ sold AND down to a low absolute count — a
 * large tier that's 70% sold but still has hundreds left shouldn't cry wolf.
 * Below 70% sold, always undefined (no badge), regardless of remaining count.
 */
export function ticketUrgency(available: number, sold: number): UrgencyLevel | undefined {
  const remaining = available - sold;
  if (remaining <= 0) return 'sold_out';

  const percentSold = available > 0 ? sold / available : 0;
  if (percentSold < 0.7) return undefined;

  if (remaining <= 10) return 'almost_gone';
  if (remaining <= 30) return 'very_few_left';
  if (remaining <= 50) return 'few_left';
  return undefined;
}
