import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { normalizeEmailDomains } from '@/lib/server/domainRestriction';
import { TIER_DESCRIPTION_MAX } from '@/lib/tiers';

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
    const updates: Record<string, unknown> = {};

    // Renaming is free until the tier sells: after that, buyers' tickets and
    // emails carry the name they paid for.
    if (body.name !== undefined) {
      const name = String(body.name ?? '').trim().slice(0, 80);
      if (!name) return NextResponse.json({ error: 'Tier name can’t be empty' }, { status: 400 });
      if (tier.sold > 0) {
        return NextResponse.json({ error: 'Tickets in this tier have sold, so its name can’t be changed.' }, { status: 409 });
      }
      updates.name = name;
    }

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

    if (body.description !== undefined) {
      const raw = body.description == null ? '' : String(body.description);
      const trimmed = raw.trim().slice(0, TIER_DESCRIPTION_MAX);
      updates.description = trimmed.length ? trimmed : null;
    }

    // Tier gates (054). Turning the promo gate on is allowed with no codes yet
    // (the page warns that nobody can buy until a code is added); turning it
    // off makes the tier open to everyone again, codes are kept for later.
    if (body.requires_code !== undefined) {
      updates.requires_code = body.requires_code === true;
    }
    if (body.allowed_email_domains !== undefined) {
      const raw = Array.isArray(body.allowed_email_domains) ? body.allowed_email_domains : [];
      const domains = normalizeEmailDomains(raw);
      if (raw.some((d: unknown) => String(d ?? '').trim()) && domains.length === 0) {
        return NextResponse.json({ error: 'Enter email domains like company.com or unilag.edu.ng' }, { status: 400 });
      }
      updates.allowed_email_domains = domains.length ? domains : null;
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

// Matches HORIZON_HOURS in lib/server/reconcile.ts: a checkout this recent can
// still turn into a ticket for this tier.
const CHECKOUT_HORIZON_HOURS = 48;

/**
 * Remove a tier that has never sold. Any ticket (even refunded) or a recent
 * checkout keeps it, since those rows point at the tier. An event keeps at
 * least one tier.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, tierId } = await params;
    const db = getServerSupabase();

    const { data: event } = await db.from('events').select('id, organizer_id').eq('id', id).maybeSingle();
    if (!event || event.organizer_id !== user.sub) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: tiers, error: tiersErr } = await db.from('ticket_tiers').select('id, sold').eq('event_id', id);
    if (tiersErr) throw tiersErr;
    const tier = (tiers ?? []).find(t => t.id === tierId);
    if (!tier) return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    if ((tiers ?? []).length <= 1) {
      return NextResponse.json({ error: 'Your event needs at least one ticket tier.' }, { status: 400 });
    }

    const horizon = new Date(Date.now() - CHECKOUT_HORIZON_HOURS * 3600 * 1000).toISOString();
    const [tickets, recent] = await Promise.all([
      db.from('tickets').select('id', { count: 'exact', head: true }).eq('tier_id', tierId),
      // Multi-tier carts list tiers in `items`, so check the whole event.
      db.from('pending_orders').select('reference', { count: 'exact', head: true }).eq('event_id', id).gt('created_at', horizon),
    ]);
    if (tickets.error || recent.error) throw tickets.error ?? recent.error;
    if (tier.sold > 0 || (tickets.count ?? 0) > 0) {
      return NextResponse.json({ error: 'Tickets in this tier have been sold, so it can’t be removed. You can set its quantity to what has sold to stop further sales.' }, { status: 409 });
    }
    if ((recent.count ?? 0) > 0) {
      return NextResponse.json({ error: `Someone started checkout for this event in the last ${CHECKOUT_HORIZON_HOURS} hours, so tiers can’t be removed yet. Try again once that window has passed.` }, { status: 409 });
    }

    // Old abandoned checkouts still reference the tier (FK, no cascade).
    const { error: poErr } = await db.from('pending_orders').delete().eq('tier_id', tierId);
    if (poErr) throw poErr;
    // Access codes cascade (054).
    const { error } = await db.from('ticket_tiers').delete().eq('id', tierId).eq('event_id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/organizer/events/[id]/tiers/[tierId] error', err);
    return NextResponse.json({ error: 'Failed to remove tier' }, { status: 500 });
  }
}
