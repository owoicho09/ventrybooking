import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, tierId } = await params;
    const db = getServerSupabase();

    // Verify event ownership
    const { data: event } = await db
      .from('events')
      .select('id, organizer_id')
      .eq('id', id)
      .single();

    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Fetch existing tier
    const { data: tier } = await db
      .from('ticket_tiers')
      .select('id, sold, available')
      .eq('id', tierId)
      .eq('event_id', id)
      .single();

    if (!tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, number> = {};

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (price < 0) return NextResponse.json({ error: 'Price cannot be negative' }, { status: 400 });
      updates.price = price;
    }

    if (body.available !== undefined) {
      const available = Number(body.available);
      if (available < tier.sold) {
        return NextResponse.json(
          { error: `Cannot set quantity below tickets already sold (${tier.sold})` },
          { status: 400 },
        );
      }
      updates.available = available;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { error } = await db.from('ticket_tiers').update(updates).eq('id', tierId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/organizer/events/[id]/tiers/[tierId] error', err);
    return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 });
  }
}
