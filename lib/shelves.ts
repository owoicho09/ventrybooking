// Adaptive shelf engine for the browse page.
//
// Every shelf is a query + heading + subheading + minimum item threshold.
// A shelf that can't meet its threshold isn't rendered at all; a shelf can
// offer fallback variants (e.g. "this weekend" → "coming up next") that are
// tried in order, each honestly headed for what it actually contains. Shelves
// render in priority order. An event may appear on the page at most twice
// (featured counts), and never in two adjacent sections.
import { CATEGORY_ORDER, categoryMeta } from '@/lib/categories';
import { addDays, weekendRange, type PublicEvent } from '@/lib/publicEvents';

export const DEFAULT_MIN = 3;
/** Below this many upcoming events the page collapses to the short layout. */
export const THIN_INVENTORY = 6;
const MAX_APPEARANCES = 2;

export interface ShelfVariant {
  heading: string;
  sub: string;
  events: PublicEvent[];
}

export interface ShelfContext {
  upcoming: PublicEvent[];
  past: PublicEvent[];
  today: string;
}

export interface ShelfDef {
  id: string;
  priority: number;
  /** Minimum items for the shelf to render. Defaults to DEFAULT_MIN. */
  min?: number;
  kind: 'upcoming' | 'past';
  /** Candidate variants, best first. The first one that clears the threshold wins. */
  build: (ctx: ShelfContext) => ShelfVariant[];
}

export interface Shelf extends ShelfVariant {
  id: string;
  kind: 'upcoming' | 'past';
}

const soonest = (a: PublicEvent, b: PublicEvent) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
const latest = (a: PublicEvent, b: PublicEvent) => b.date.localeCompare(a.date);

const CATEGORY_SUBS: Record<string, string> = {
  Party: 'Day parties, raves and everything in between.',
  Concert: 'Live music on a real stage.',
  Theater: 'Plays, spoken word and the performing arts.',
  Conference: 'Talks, summits and rooms worth being in.',
  Festival: 'Big days out, multiple acts.',
  Sports: 'Matches, races and tournaments.',
};

export const DEFAULT_SHELVES: ShelfDef[] = [
  {
    id: 'weekend',
    priority: 10,
    kind: 'upcoming',
    build: ({ upcoming, today }) => {
      const [from, to] = weekendRange(today);
      const in30 = addDays(today, 30);
      return [
        { heading: 'Happening this weekend', sub: 'Doors open between Friday and Sunday.', events: upcoming.filter(e => e.date >= from && e.date <= to) },
        { heading: 'Coming up next', sub: 'Everything in the next 30 days, soonest first.', events: upcoming.filter(e => e.date <= in30) },
      ];
    },
  },
  {
    id: 'selling-fast',
    priority: 20,
    kind: 'upcoming',
    build: ({ upcoming }) => [{
      heading: 'Selling fast',
      sub: 'Most of the tickets are already gone.',
      events: upcoming.filter(e => e.urgency && e.urgency !== 'sold_out'),
    }],
  },
  {
    id: 'under-10k',
    priority: 30,
    kind: 'upcoming',
    // Drop rather than widen: if fewer than the threshold sit under ₦10,000,
    // the shelf simply doesn't exist.
    build: ({ upcoming }) => [{
      heading: 'Under ₦10,000',
      sub: 'Good nights that don’t finish your month.',
      events: upcoming.filter(e => e.minPrice != null && e.minPrice > 0 && e.minPrice < 10_000).sort((a, b) => (a.minPrice ?? 0) - (b.minPrice ?? 0)),
    }],
  },
  {
    id: 'free',
    priority: 40,
    kind: 'upcoming',
    build: ({ upcoming }) => [{ heading: 'Free to attend', sub: 'Free entry. You still need a ticket at the door.', events: upcoming.filter(e => e.minPrice === 0) }],
  },
  ...CATEGORY_ORDER.filter(c => c !== 'Other').map((category, i): ShelfDef => ({
    id: `cat-${category}`,
    priority: 50 + i,
    kind: 'upcoming',
    build: ({ upcoming }) => [{
      heading: categoryMeta(category).plural,
      sub: CATEGORY_SUBS[category] ?? '',
      events: upcoming.filter(e => e.category === category && e.eventMode !== 'online'),
    }],
  })),
  {
    id: 'online',
    priority: 70,
    kind: 'upcoming',
    build: ({ upcoming }) => [{ heading: 'Online events', sub: 'Join from anywhere. The link arrives with your ticket.', events: upcoming.filter(e => e.eventMode === 'online') }],
  },
  {
    // Past events are inventory too: proof that events here actually happen.
    id: 'recent',
    priority: 100,
    min: 2,
    kind: 'past',
    build: ({ past }) => [{
      heading: 'Recently on Ventry',
      sub: past.some(e => e.rating) ? 'Rated by the people who were actually in the room.' : 'Sold, scanned at the door, and done.',
      events: [...past].sort(latest).slice(0, 12),
    }],
  },
];

export interface Feed {
  mode: 'full' | 'thin';
  featured: PublicEvent | null;
  /** Upcoming shelves, in render order. */
  shelves: Shelf[];
  /** "Recently on Ventry", or null if it can't meet its threshold. */
  recent: Shelf | null;
  /** The full grid: every upcoming event except the featured one. */
  grid: PublicEvent[];
}

function pickFeatured(upcoming: PublicEvent[]): PublicEvent | null {
  if (!upcoming.length) return null;
  // The soonest event that has artwork and is still selling; any event otherwise.
  return [...upcoming].sort(soonest).find(e => e.flyerUrl && !e.soldOut) ?? [...upcoming].sort(soonest)[0];
}

export function buildFeed(ctx: ShelfContext, defs: ShelfDef[] = DEFAULT_SHELVES): Feed {
  const upcoming = [...ctx.upcoming].sort(soonest);
  const past = [...ctx.past].sort(latest);
  const featured = pickFeatured(upcoming);
  const grid = upcoming.filter(e => e.id !== featured?.id);
  const sorted = [...defs].sort((a, b) => a.priority - b.priority);
  const recentDef = sorted.find(d => d.kind === 'past');

  const resolve = (def: ShelfDef, counts: Map<string, number>, previous: Set<string>): Shelf | null => {
    const min = def.min ?? DEFAULT_MIN;
    for (const variant of def.build({ ...ctx, upcoming, past })) {
      const events = variant.events.filter(e => (counts.get(e.id) ?? 0) < MAX_APPEARANCES && !previous.has(e.id));
      if (events.length >= min) return { ...variant, events, id: def.id, kind: def.kind };
    }
    return null;
  };

  const recent = recentDef ? resolve(recentDef, new Map(), new Set()) : null;

  if (upcoming.length < THIN_INVENTORY) {
    return { mode: 'thin', featured, shelves: [], recent, grid };
  }

  const counts = new Map<string, number>();
  let previous = new Set<string>();
  if (featured) {
    counts.set(featured.id, 1);
    previous = new Set([featured.id]);
  }
  const shelves: Shelf[] = [];
  for (const def of sorted) {
    if (def.kind !== 'upcoming') continue;
    const shelf = resolve(def, counts, previous);
    if (!shelf) continue;
    shelves.push(shelf);
    for (const e of shelf.events) counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
    previous = new Set(shelf.events.map(e => e.id));
  }

  return { mode: 'full', featured, shelves, recent, grid };
}
