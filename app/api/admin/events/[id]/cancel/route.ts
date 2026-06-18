import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { refundTransaction } from '@/lib/server/paystack';
import { notify } from '@/lib/server/notify';

// GET — preview: count of refundable tickets + total refund amount (no side effects)
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

  const { data: event } = await db
    .from('events')
    .select('id, event_name, status')
    .eq('id', id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.status !== 'approved') {
    return NextResponse.json({ error: 'Only approved events can be cancelled' }, { status: 400 });
  }

  const { data: tickets } = await db
    .from('tickets')
    .select('id, tier_id, paystack_reference')
    .eq('event_id', id)
    .neq('status', 'refunded');

  const ticketCount = tickets?.length ?? 0;
  const refundableCount = tickets?.filter(t => t.paystack_reference).length ?? 0;

  let totalRefund = 0;
  if (tickets && tickets.length > 0) {
    const tierIds = [...new Set(tickets.map(t => t.tier_id).filter(Boolean))] as string[];
    const { data: tiers } = await db
      .from('ticket_tiers')
      .select('id, price')
      .in('id', tierIds);

    const tierMap = Object.fromEntries((tiers ?? []).map(t => [t.id, t.price]));
    totalRefund = tickets.reduce((sum, t) => sum + (tierMap[t.tier_id] ?? 0), 0);
  }

  return NextResponse.json({
    success: true,
    data: { eventName: event.event_name, ticketCount, refundableCount, totalRefund },
  });
}

// POST — execute: mark event cancelled, issue Paystack refund per active ticket
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServerSupabase();

  const { data: event } = await db
    .from('events')
    .select('id, event_name, status, organizer_id')
    .eq('id', id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.status !== 'approved') {
    return NextResponse.json({ error: 'Only approved events can be cancelled' }, { status: 400 });
  }

  // Mark event cancelled before processing refunds so no new tickets can be sold
  await db.from('events').update({ status: 'cancelled' }).eq('id', id);

  const { data: tickets } = await db
    .from('tickets')
    .select('id, tier_id, paystack_reference, buyer_email')
    .eq('event_id', id)
    .neq('status', 'refunded');

  if (!tickets || tickets.length === 0) {
    notify({ type: 'admin' }, {
      notifType: 'event',
      title: `Event cancelled — ${event.event_name}`,
      body: 'No tickets were outstanding; no refunds required.',
      link: '/admin/events',
    }).catch(console.error);
    return NextResponse.json({ success: true, data: { refunded: 0, failed: 0, failures: [] } });
  }

  // Build tier price map so each ticket refund uses the canonical base price (not total_paid)
  const tierIds = [...new Set(tickets.map(t => t.tier_id).filter(Boolean))] as string[];
  const { data: tiers } = await db.from('ticket_tiers').select('id, price').in('id', tierIds);
  const tierMap = Object.fromEntries((tiers ?? []).map(t => [t.id, t.price]));

  let refunded = 0;
  const failures: { ticketId: string; email: string; reason: string }[] = [];

  for (const ticket of tickets) {
    if (!ticket.paystack_reference) {
      failures.push({ ticketId: ticket.id, email: ticket.buyer_email, reason: 'No payment reference on file' });
      continue;
    }

    const refundAmount = tierMap[ticket.tier_id] ?? 0;
    if (refundAmount <= 0) {
      failures.push({ ticketId: ticket.id, email: ticket.buyer_email, reason: 'Could not determine tier price' });
      continue;
    }

    try {
      await refundTransaction({ transaction: ticket.paystack_reference, amount: refundAmount * 100 });
      await db.from('tickets').update({ status: 'refunded' }).eq('id', ticket.id);
      refunded++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Paystack refund failed';
      failures.push({ ticketId: ticket.id, email: ticket.buyer_email, reason });
    }
  }

  // Notify organiser their event was cancelled
  notify({ type: 'organizer', id: event.organizer_id }, {
    notifType: 'event',
    title: `Event cancelled — ${event.event_name}`,
    body: `Your event was cancelled by admin. ${refunded} ticket${refunded !== 1 ? 's' : ''} will be refunded to buyers.`,
    link: '/organizer/events',
  }).catch(console.error);

  // Notify admin feed so the bell shows this action
  notify({ type: 'admin' }, {
    notifType: 'event',
    title: `Event cancelled — ${event.event_name}`,
    body: `${refunded} refund${refunded !== 1 ? 's' : ''} processed${failures.length > 0 ? `, ${failures.length} failed` : ' successfully'}.`,
    link: '/admin/events',
  }).catch(console.error);

  return NextResponse.json({
    success: true,
    data: { refunded, failed: failures.length, failures },
  });
}
