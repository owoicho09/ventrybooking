export type LineupLiability = 'headliner' | 'guest' | 'surprise';

export interface LineupAct {
  name: string;
  role: string;
  liability: LineupLiability;
  photoUrl?: string | null;
}

const VALID_LIABILITIES: LineupLiability[] = ['headliner', 'guest', 'surprise'];

/**
 * Validates and normalizes a lineup array from client input.
 *
 * Everything is silently coerced to a safe default except one rule: at most
 * one Headliner. That role carries refund liability if the act doesn't
 * perform, so it's the one thing an organiser should have to consciously
 * pick rather than have quietly changed for them — hence a thrown error
 * instead of auto-demoting a second one to Guest.
 */
export function normalizeLineup(raw: unknown): LineupAct[] {
  if (!Array.isArray(raw)) return [];

  const acts: LineupAct[] = raw
    .map((a: { name?: unknown; role?: unknown; liability?: unknown; photoUrl?: unknown }) => ({
      name: String(a?.name ?? '').trim(),
      role: String(a?.role ?? '').trim(),
      liability: (VALID_LIABILITIES as string[]).includes(a?.liability as string)
        ? (a!.liability as LineupLiability)
        : 'guest',
      photoUrl: a?.photoUrl ? String(a.photoUrl) : null,
    }))
    // Surprise Guest entries don't need a name to be kept — the whole point
    // is the name isn't shown — but every other role does.
    .filter(a => a.liability === 'surprise' || a.name);

  const headlinerCount = acts.filter(a => a.liability === 'headliner').length;
  if (headlinerCount > 1) {
    throw new Error(
      "Only one lineup entry can be marked Headliner — it's the single act the ticket is sold on and carries refund liability if they don't perform. Change the others to Guest Artist or Surprise Guest.",
    );
  }

  return acts;
}

/** Strips the name from Surprise Guest entries before sending lineup data to the public. */
export function redactSurpriseNames(lineup: LineupAct[] | null | undefined): LineupAct[] {
  return (lineup ?? []).map(a => (a.liability === 'surprise' ? { ...a, name: '' } : a));
}
