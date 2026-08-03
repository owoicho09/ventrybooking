import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

// Cities are free text on the organizer's event form, so the filter dropdown can't
// use a fixed list — it needs to reflect whatever cities actually have approved
// events. Trimmed/deduped case-sensitively (organizer input isn't normalized) and
// sorted alphabetically.
export async function GET() {
  try {
    const db = getServerSupabase();
    const { data, error } = await db
      .from('events')
      .select('city')
      .eq('status', 'approved')
      .eq('event_mode', 'physical');

    if (error) throw error;

    const cities = [...new Set((data ?? []).map(row => row.city?.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json(
      { success: true, data: cities },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (err) {
    console.error('GET /api/events/cities error', err);
    return NextResponse.json({ error: 'Failed to fetch cities' }, { status: 500 });
  }
}
