import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { refundTransaction } from '@/lib/server/paystack';
import { sendRefundConfirmationEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';
import { calculateFees, basePriceFromTotalPaid } from '@/lib/server/fees';

// POST — admin refunds one or more specific tickets for an event, without
// cancelling the event or touching any other ticket. Distinct from
// /api/admin/events/[id]/cancel, which refunds every outstanding ticket.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const ticketIds: string[] = Array.isArray(body.ticketIds) ? body.ticketIds.filter((v: unknown) => typeof v === 'string') : [];
  const reason: string | null = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;

  if (ticketIds.length === 0) {
    return NextResponse.json({ error: 'No tickets selected' }, { status: 400 });
  }

  const db = getServerSupabase();

  const { data: event } = await db
    .from('events')
    .select('id, event_name, organizer_id')
    .eq('id', id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Escrow gate — once the payout has been released (or is mid-transfer),
  // the funds are no longer under Ventry's control for this event.
  const { data: payout } = await db
    .from('payouts')
    .select('id, gross, status')
    .eq('event_id', id)
    .maybeSingle();

  if (payout && (payout.status === 'completed' || payout.status === 'otp_pending')) {
    return NextResponse.json(
      { error: 'Payout for this event has already been released — funds are no longer held in escrow. Refund manually via the Paystack dashboard.' },
      { status: 400 },
    );
  }

  const { data: tickets, error: ticketsErr } = await db
    .from('tickets')
    .select('id, tier_id, buyer_email, paystack_reference, total_paid, subtotal, status')
    .eq('event_id', id)
    .in('id', ticketIds);

  if (ticketsErr) {
    console.error('refund tickets: DB error', ticketsErr);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  const found = tickets ?? [];
  const failures: { ticketId: string; email: string; reason: string }[] = [];

  const foundIds = new Set(found.map(t => t.id));
  for (const requestedId of ticketIds) {
    if (!foundIds.has(requestedId)) {
      failures.push({ ticketId: requestedId, email: '', reason: 'Ticket not found on this event' });
    }
  }

  const alreadyRefunded = found.filter(t => t.status === 'refunded');
  for (const t of alreadyRefunded) {
    failures.push({ ticketId: t.id, email: t.buyer_email, reason: 'Already refunded' });
  }

  const refundable = found.filter(t => t.status !== 'refunded');
  if (refundable.length === 0) {
    return NextResponse.json({ success: true, data: { refunded: 0, failed: failures.length, failures } });
  }

  let refunded = 0;
  let totalRefundedAmount = 0;
  const nowIso = new Date().toISOString();

  const tierRefundCounts = new Map<string, number>();
  const bumpTierRefundCount = (tierId: string | null) => {
    if (!tierId) return;
    tierRefundCounts.set(tierId, (tierRefundCounts.get(tierId) ?? 0) + 1);
  };
  const refundedTicketsForEmail: { ticketId: string; email: string; amount: number }[] = [];

  const markRefunded = async (ticketId: string) => {
    const { error } = await db
      .from('tickets')
      .update({ status: 'refunded', refunded_at: nowIso, refunded_by: user.email, refund_reason: reason })
      .eq('id', ticketId);
    return error;
  };

  // Free tickets (no payment reference) — mark refunded directly, no Paystack call.
  const freeTickets = refundable.filter(t => !t.paystack_reference);
  const paidTickets = refundable.filter(t => t.paystack_reference);

  for (const ticket of freeTickets) {
    const refundAmount = ticket.subtotal ?? basePriceFromTotalPaid(ticket.total_paid);
    if (refundAmount > 0) {
      failures.push({ ticketId: ticket.id, email: ticket.buyer_email, reason: 'No payment reference on file — refund manually via Paystack dashboard' });
      continue;
    }
    const err = await markRefunded(ticket.id);
    if (err) {
      console.error('refund tickets: DB update failed for free ticket', ticket.id, err);
      failures.push({ ticketId: ticket.id, email: ticket.buyer_email, reason: 'Database update failed' });
      continue;
    }
    refunded++;
    bumpTierRefundCount(ticket.tier_id);
    refundedTicketsForEmail.push({ ticketId: ticket.id, email: ticket.buyer_email, amount: 0 });
  }

  // Group selected paid tickets by paystack_reference so tickets from the same
  // order are refunded in a single Paystack call (a second call against the
  // same reference before the first settles is rejected).
  const byReference = new Map<string, typeof paidTickets>();
  for (const ticket of paidTickets) {
    const ref = ticket.paystack_reference!;
    if (!byReference.has(ref)) byReference.set(ref, []);
    byReference.get(ref)!.push(ticket);
  }

  for (const [reference, group] of byReference) {
    const groupAmount = group.reduce((sum, t) => sum + (t.subtotal ?? basePriceFromTotalPaid(t.total_paid)), 0);

    if (groupAmount === 0) {
      for (const ticket of group) {
        const err = await markRefunded(ticket.id);
        if (err) {
          failures.push({ ticketId: ticket.id, email: ticket.buyer_email, reason: 'Database update failed' });
          continue;
        }
        refunded++;
        bumpTierRefundCount(ticket.tier_id);
        refundedTicketsForEmail.push({ ticketId: ticket.id, email: ticket.buyer_email, amount: 0 });
      }
      continue;
    }

    try {
      await refundTransaction({ transaction: reference, amount: groupAmount * 100 });
    } catch (err) {
      const reasonMsg = err instanceof Error ? err.message : 'Paystack refund failed';
      for (const ticket of group) failures.push({ ticketId: ticket.id, email: ticket.buyer_email, reason: reasonMsg });
      continue;
    }

    // Paystack has now refunded the buyer's money. Any DB failure from here on
    // must never be treated as "the refund failed" — retrying would double-refund.
    for (const ticket of group) {
      const refundAmount = ticket.subtotal ?? basePriceFromTotalPaid(ticket.total_paid);
      const err = await markRefunded(ticket.id);
      if (err) {
        console.error('refund tickets: Paystack refund succeeded but DB update failed', ticket.id, err);
        notify(
          { type: 'admin' },
          {
            notifType: 'refund',
            title:     `Refund DB update failed — ${event.event_name}`,
            body:      `Paystack refunded ${ticket.id} but the database was not updated. Fix it manually.`,
            link:      `/admin/events/${id}`,
          },
        ).catch(console.error);
      } else {
        bumpTierRefundCount(ticket.tier_id);
      }
      refunded++;
      totalRefundedAmount += refundAmount;
      refundedTicketsForEmail.push({ ticketId: ticket.id, email: ticket.buyer_email, amount: refundAmount });
    }
  }

  // Give refunded tickets back to inventory.
  for (const [tierId, count] of tierRefundCounts) {
    const { error: tierErr } = await db.rpc('increment_tier_sold', { tier_id: tierId, amount: -count });
    if (tierErr) console.error('refund tickets: tier sold-count decrement failed', { tierId, count, tierErr });
  }

  // Reduce the linked payout by the amount actually refunded, same as the
  // full-event-cancel and complaint-refund flows.
  if (totalRefundedAmount > 0 && payout) {
    const { data: org } = await db
      .from('users')
      .select('platform_fee_rate')
      .eq('id', event.organizer_id)
      .maybeSingle();
    const newGross = Math.max(0, payout.gross - totalRefundedAmount);
    const { fee, net } = calculateFees(newGross, org?.platform_fee_rate);
    await db.from('payouts').update({ gross: newGross, fee, net }).eq('id', payout.id);
  }

  // Ticket invalidation is implicit: the scan endpoint only admits status='valid',
  // so a refunded ticket fails at the door with no separate step needed.

  for (const t of refundedTicketsForEmail) {
    try {
      await sendRefundConfirmationEmail(t.email, t.ticketId, t.amount, event.event_name);
    } catch (err) {
      console.error('refund tickets: confirmation email error', t.ticketId, err);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

  if (refunded > 0) {
    notify(
      { type: 'organizer', id: event.organizer_id },
      {
        notifType: 'refund',
        title:     `${refunded} ticket${refunded !== 1 ? 's' : ''} refunded — ${event.event_name}`,
        body:      `Ventry admin refunded ${fmt(totalRefundedAmount)} to ${refunded} buyer ticket${refunded !== 1 ? 's' : ''}.${reason ? ` Reason: ${reason}` : ''}`,
        link:      '/organizer/payouts',
      },
    ).catch(console.error);
  }

  return NextResponse.json({
    success: true,
    data: { refunded, failed: failures.length, failures },
  });
}
