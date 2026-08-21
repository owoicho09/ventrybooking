import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// GET — admin event drill-down: summary + full ticket/buyer list + payout status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServerSupabase();

  const [{ data: event, error: eventErr }, { data: tickets, error: ticketsErr }, { data: payout }] = await Promise.all([
    db
      .from('events')
      .select(`
        id, event_name, slug, category, date, time, status, event_mode, venue, city,
        organizer:users!events_organizer_id_fkey(id, name),
        tiers:ticket_tiers(id, name, price, available, sold)
      `)
      .eq('id', id)
      .maybeSingle(),
    db
      .from('tickets')
      .select('id, buyer_name, buyer_email, tier_id, total_paid, subtotal, status, purchased_at, paystack_reference, refunded_at, refunded_by, refund_reason')
      .eq('event_id', id)
      .order('purchased_at', { ascending: false }),
    db.from('payouts').select('status, released_at').eq('event_id', id).maybeSingle(),
  ]);

  if (eventErr || ticketsErr) {
    console.error('GET /api/admin/events/[id] error', { eventErr, ticketsErr });
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const organizerRaw = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
  const organizer = organizerRaw as { id: string; name: string } | null;
  type TierRow = { id: string; name: string; price: number; available: number; sold: number };
  const tiers = (event.tiers as TierRow[]) ?? [];
  const tierById = new Map(tiers.map(t => [t.id, t.name]));

  // This organiser's all-time totals across every event they've run, not just
  // this one — surfaced here so admin doesn't need to jump to the full
  // organiser profile just to see the bigger picture.
  let organizerTotalSold = 0;
  let organizerTotalEvents = 0;
  if (organizer) {
    const { data: orgEvents } = await db
      .from('events')
      .select('id, tiers:ticket_tiers(sold)')
      .eq('organizer_id', organizer.id);
    organizerTotalEvents = orgEvents?.length ?? 0;
    organizerTotalSold = (orgEvents ?? []).reduce(
      (sum, ev) => sum + ((ev.tiers as { sold: number }[] ?? []).reduce((s, t) => s + (t.sold ?? 0), 0)),
      0,
    );
  }

  const totalSold    = tiers.reduce((s, t) => s + (t.sold ?? 0), 0);
  const totalRevenue = (tickets ?? [])
    .filter(t => t.status !== 'refunded')
    .reduce((s, t) => s + (t.total_paid ?? 0), 0);

  // Released/otp_pending means Paystack funds have already left escrow for this event —
  // refunds can no longer be issued against it (see the refund endpoint's own check,
  // this flag just lets the UI explain why up front).
  const payoutReleased = payout?.status === 'completed' || payout?.status === 'otp_pending';

  const rows = (tickets ?? []).map(t => ({
    id:                 t.id,
    buyer_name:         t.buyer_name,
    buyer_email:        t.buyer_email,
    tier_name:          tierById.get(t.tier_id) ?? 'Unknown',
    total_paid:         t.total_paid,
    refund_amount:      t.subtotal ?? t.total_paid,
    status:             t.status,
    purchased_at:       t.purchased_at,
    has_reference:      Boolean(t.paystack_reference),
    refunded_at:        t.refunded_at,
    refunded_by:        t.refunded_by,
    refund_reason:      t.refund_reason,
  }));

  return NextResponse.json({
    success: true,
    data: {
      id:             event.id,
      event_name:     event.event_name,
      slug:           event.slug,
      category:       event.category,
      date:           event.date,
      time:           event.time,
      status:         event.status,
      event_mode:     event.event_mode,
      venue:          event.venue,
      city:           event.city,
      organizer_id:   organizer?.id ?? null,
      organizer_name: organizer?.name ?? 'Unknown',
      organizerTotalSold,
      organizerTotalEvents,
      tiers,
      totalSold,
      totalRevenue,
      payoutReleased,
      tickets: rows,
    },
  });
}
