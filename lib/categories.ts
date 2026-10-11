import type { CSSProperties } from 'react';

// Category colour tokens for the public pages. The colours themselves live
// in app/v2.css as --cat-<key>-* custom properties; this maps the stored
// events.category values (and the online event mode) onto those keys plus
// buyer-facing labels. Parties pink, concerts emerald, theatre amber,
// conferences teal, nightlife/festival purple, online indigo.
export type CategoryKey = 'party' | 'concert' | 'theatre' | 'conf' | 'night' | 'online' | 'sports' | 'other';

interface CategoryMeta {
  key: CategoryKey;
  /** Singular label, used on card pills. */
  label: string;
  /** Plural label, used on chips and tiles. */
  plural: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  Party:      { key: 'party',   label: 'Party',      plural: 'Parties' },
  Concert:    { key: 'concert', label: 'Concert',    plural: 'Concerts' },
  Theater:    { key: 'theatre', label: 'Theatre',    plural: 'Theatre & arts' },
  Conference: { key: 'conf',    label: 'Conference', plural: 'Conferences' },
  Festival:   { key: 'night',   label: 'Festival',   plural: 'Festivals' },
  Sports:     { key: 'sports',  label: 'Sports',     plural: 'Sports' },
  Other:      { key: 'other',   label: 'Other',      plural: 'Everything else' },
};

/** Order chips and tiles appear in. */
export const CATEGORY_ORDER = ['Party', 'Concert', 'Theater', 'Conference', 'Festival', 'Sports', 'Other'];

export const ONLINE_META: CategoryMeta = { key: 'online', label: 'Online', plural: 'Online events' };

export function categoryMeta(category: string | null | undefined): CategoryMeta {
  return CATEGORY_META[category ?? ''] ?? CATEGORY_META.Other;
}

/** CSS variables a pill/chip/tile reads (--c, --cfg, --cs, --cd). */
export function categoryVars(key: CategoryKey): CSSProperties {
  return {
    '--c': `var(--cat-${key})`,
    '--cfg': `var(--cat-${key}-fg)`,
    '--cs': `var(--cat-${key}-solid)`,
    '--cd': `var(--cat-${key}-deep)`,
  } as CSSProperties;
}

/** Placeholder gradient for an event with no flyer, in its category colour. */
export function categoryGradient(key: CategoryKey): string {
  return `linear-gradient(150deg, var(--cat-${key}-solid), var(--cat-${key}-deep))`;
}
