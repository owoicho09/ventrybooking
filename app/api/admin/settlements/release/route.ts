import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { loadHolidays, releaseForOrganizer, type ReleaseResult } from '@/lib/server/settlements';

// Each organiser is two Paystack calls; a bulk release of a couple of dozen
// needs more than the default function time.
export const maxDuration = 60;

const MAX_PER_REQUEST = 25;

/**
 * Releases everything releasable for the given organisers, one at a time.
 * Each organiser succeeds or fails on its own; a replayed request for an
 * already-released period comes back as 'noop' for that organiser.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const organizerIds = Array.isArray(body.organizerIds)
    ? Array.from(new Set((body.organizerIds as unknown[]).filter((v): v is string => typeof v === 'string')))
    : [];
  if (organizerIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one organiser' }, { status: 400 });
  }
  if (organizerIds.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: `Release at most ${MAX_PER_REQUEST} organisers at a time` }, { status: 400 });
  }

  const db = getServerSupabase();
  let holidays: Map<string, string>;
  try {
    holidays = await loadHolidays(db);
  } catch (err) {
    console.error('settlement release: holidays', err);
    return NextResponse.json({ error: 'Could not load the holiday calendar — nothing was released' }, { status: 500 });
  }

  const results: ReleaseResult[] = [];
  for (const id of organizerIds) {
    try {
      results.push(await releaseForOrganizer(db, id, user.email, holidays));
    } catch (err) {
      console.error('settlement release error', id, err);
      results.push({ organizerId: id, outcome: 'error', message: err instanceof Error ? err.message : 'Release failed' });
    }
  }

  return NextResponse.json({ success: true, data: { results } });
}
