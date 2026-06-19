import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data: event } = await db
      .from('events')
      .select('id, organizer_id')
      .eq('id', id)
      .single();

    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { name, price, quantity } = await req.json();

    if (!name || price === undefined || !quantity) {
      return NextResponse.json({ error: 'name, price, and quantity are required' }, { status: 400 });
    }
    if (Number(price) < 0) {
      return NextResponse.json({ error: 'Price cannot be negative' }, { status: 400 });
    }
    if (Number(quantity) < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
    }

    const { data: tier, error } = await db
      .from('ticket_tiers')
      .insert({
        event_id:  id,
        name:      name.trim(),
        price:     Number(price),
        available: Number(quantity),
        sold:      0,
      })
      .select('id, name, price, available, sold')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: tier }, { status: 201 });
  } catch (err) {
    console.error('POST /api/organizer/events/[id]/tiers error', err);
    return NextResponse.json({ error: 'Failed to add tier' }, { status: 500 });
  }
}
