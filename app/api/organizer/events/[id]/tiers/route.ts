import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseTierGates } from '@/lib/server/tierGatesInput';
import { TIER_DESCRIPTION_MAX } from '@/lib/tiers';

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

    const body = await req.json();
    const { name, price, quantity, description } = body;

    if (!name || price === undefined || !quantity) {
      return NextResponse.json({ error: 'name, price, and quantity are required' }, { status: 400 });
    }
    if (Number(price) < 0) {
      return NextResponse.json({ error: 'Price cannot be negative' }, { status: 400 });
    }
    if (Number(quantity) < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
    }
    const gates = parseTierGates(body, String(name).trim() || 'This tier');
    if (!gates.ok) return NextResponse.json({ error: gates.error }, { status: 400 });
    if (gates.value.codes.length) {
      const { data: taken } = await db.from('tier_access_codes').select('code').eq('event_id', id).in('code', gates.value.codes);
      if (taken?.length) return NextResponse.json({ error: `The code ${taken[0].code} is already used on another tier of this event.` }, { status: 409 });
    }

    const { data: tier, error } = await db
      .from('ticket_tiers')
      .insert({
        event_id:  id,
        name:      name.trim(),
        price:     Number(price),
        available: Number(quantity),
        sold:      0,
        description: typeof description === 'string' && description.trim().length ? description.trim().slice(0, TIER_DESCRIPTION_MAX) : null,
        requires_code: gates.value.requiresCode,
        allowed_email_domains: gates.value.allowedEmailDomains.length ? gates.value.allowedEmailDomains : null,
      })
      .select('id, name, price, description, available, sold, requires_code, allowed_email_domains')
      .single();

    if (error) throw error;
    if (gates.value.codes.length) {
      const { error: codeErr } = await db.from('tier_access_codes').insert(
        gates.value.codes.map(code => ({ event_id: id, tier_id: tier.id, code })),
      );
      if (codeErr) throw codeErr;
    }

    return NextResponse.json({ success: true, data: tier }, { status: 201 });
  } catch (err) {
    console.error('POST /api/organizer/events/[id]/tiers error', err);
    return NextResponse.json({ error: 'Failed to add tier' }, { status: 500 });
  }
}
