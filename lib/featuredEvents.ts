/**
 * Featured events (official partners). They are always on the homepage hero
 * deck and listed first among on-sale events, ahead of the date order.
 * Add or remove event IDs here; the earlier an ID is listed, the higher it ranks.
 */
const FEATURED_EVENT_IDS: string[] = [
  // IJGB: The Homecoming — Cruise Nation (official partner)
  'd5643201-a37a-44eb-b733-41b7a5b9321b',
];

/**
 * Homepage hero deck only (the three floating cards). Pinned events always
 * take a card, like featured partners, without being ranked first anywhere
 * else; hidden ones never get a card.
 */
const HERO_PINNED_EVENT_IDS: string[] = [
  // Alien Invasion — Jubys entertainment
  '71f03524-86a3-4e8f-a5de-d5be886c1728',
];
const HERO_HIDDEN_EVENT_IDS: string[] = [
  // 4-4-2 (taken off the hero 2026-11-19)
  '3fb9023d-f480-4114-872b-84b9068010ea',
];

export function isHeroPinned(eventId: string): boolean {
  return FEATURED_EVENT_IDS.includes(eventId) || HERO_PINNED_EVENT_IDS.includes(eventId);
}

export function isHeroHidden(eventId: string): boolean {
  return HERO_HIDDEN_EVENT_IDS.includes(eventId);
}

/** Rank of a featured event (0 = top), or -1 when it isn't featured. */
export function featuredRank(eventId: string): number {
  return FEATURED_EVENT_IDS.indexOf(eventId);
}

export function isFeaturedEvent(eventId: string): boolean {
  return featuredRank(eventId) !== -1;
}

/** Stable re-order: featured events first (in their listed order), the rest unchanged. */
export function featuredFirst<T extends { id: string }>(list: T[]): T[] {
  const rank = (e: T) => { const r = featuredRank(e.id); return r === -1 ? Infinity : r; };
  return list
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (rank(a.e) - rank(b.e)) || (a.i - b.i))
    .map(x => x.e);
}
