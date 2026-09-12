import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyTicketLink } from '@/lib/server/ticketLinks';
import { refundTransaction } from '@/lib/server/paystack';
import { sendRefundConfirmationEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';
import { calculateFees, basePriceFromTotalPaid } from '@/lib/server/fees';

const CONTACT_SUPPORT = 'Please contact support@ventrybooking.com for help.';

// GET — read-only preview of what this link offers, so the page can show the
// buyer what changed and the deadline before they commit to anything.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let payload;
  try {
    payload = verifyTicketLink(token);
  } catch {
    return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 });
  }
  if (payload.purpose !== 'refund_opt_out' || !payload.changeId) {
    return NextResponse.json({ error: 'This link is not a valid refund link.' }, { status: 400 });
  }

  const db = getServerSupabase();

  const { data: ticket } = await db
    .from('tickets')
    .select('id, event_id, buyer_name, buyer_email, status, subtotal, total_paid, purchased_at')
    .eq('id', payload.ticketId)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

  const { data: change } = await db
    .from('event_changes')
    .select('id, event_id, change_type, old_value, new_value, changed_at, refund_window_closes_at')
    .eq('id', payload.changeId)
    .maybeSingle();
  if (!change || change.event_id !== ticket.event_id) {
    return NextResponse.json({ error: 'This link is not a valid refund link.' }, { status: 400 });
  }

  const { data: event } = await db.from('events').select('event_name').eq('id', ticket.event_id).maybeSingle();

  const { data: existingClaim } = await db
    .from('ticket_change_refunds')
    .select('status')
    .eq('ticket_id', ticket.id)
    .eq('event_change_id', change.id)
    .maybeSingle();

  const windowOpen = new Date() < new Date(change.refund_window_closes_at);
  const alreadyProcessed = existingClaim?.status === 'refunded';
  const eligible = ticket.status === 'valid' && windowOpen && !existingClaim;

  return NextResponse.json({
    success: true,
    data: {
      eventName: event?.event_name ?? '',
      buyerName: ticket.buyer_name,
      changeType: change.change_type,
      oldValue: change.old_value,
      newValue: change.new_value,
      refundAmount: ticket.subtotal ?? basePriceFromTotalPaid(ticket.total_paid),
      windowClosesAt: change.refund_window_closes_at,
      eligible,
      alreadyProcessed,
      ticketStatus: ticket.status,
      windowOpen,
    },
  });
}

// POST — actually process the refund. Everything the GET checked is
// re-verified here server-side rather than trusted from the client.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let payload;
  try {
    payload = verifyTicketLink(token);
  } catch {
    return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 });
  }
  if (payload.purpose !== 'refund_opt_out' || !payload.changeId) {
    return NextResponse.json({ error: 'This link is not a valid refund link.' }, { status: 400 });
  }

  const db = getServerSupabase();

  const { data: ticket } = await db
    .from('tickets')
    .select('id, event_id, organizer_id, tier_id, buyer_email, status, subtotal, total_paid, paystack_reference, purchased_at')
    .eq('id', payload.ticketId)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

  const { data: change } = await db
    .from('event_changes')
    .select('id, event_id, change_type, changed_at, refund_window_closes_at')
    .eq('id', payload.changeId)
    .maybeSingle();
  if (!change || change.event_id !== ticket.event_id) {
    return NextResponse.json({ error: 'This link is not a valid refund link.' }, { status: 400 });
  }

  if (ticket.status !== 'valid') {
    return NextResponse.json({ error: 'This ticket is no longer eligible for a refund.' }, { status: 400 });
  }
  if (new Date() >= new Date(change.refund_window_closes_at)) {
    return NextResponse.json({ error: 'The refund window for this change has closed.' }, { status: 400 });
  }
  if (new Date(ticket.purchased_at) >= new Date(change.changed_at)) {
    // Shouldn't happen — emails only go to tickets purchased before the
    // change — but a forged/reused token shouldn't get a free pass either.
    return NextResponse.json({ error: 'This ticket was purchased after the change and is not eligible.' }, { status: 400 });
  }

  // Atomic claim — the unique (ticket_id, event_change_id) constraint makes a
  // double-click or replayed link a no-op instead of a double refund, the
  // same idempotency pattern the `purchases` table uses for webhook races.
  const { data: claim, error: claimErr } = await db
    .from('ticket_change_refunds')
    .insert({ ticket_id: ticket.id, event_change_id: change.id, status: 'pending' })
    .select('id')
    .single();

  if (claimErr) {
    if (claimErr.code === '23505') {
      const { data: existing } = await db
        .from('ticket_change_refunds')
        .select('status')
        .eq('ticket_id', ticket.id)
        .eq('event_change_id', change.id)
        .maybeSingle();
      if (existing?.status === 'refunded') {
        return NextResponse.json({ success: true, data: { alreadyProcessed: true } });
      }
      return NextResponse.json({ error: `This refund request is already being processed. ${CONTACT_SUPPORT}` }, { status: 409 });
    }
    console.error('refund-opt-out: claim insert error', claimErr);
    return NextResponse.json({ error: `Something went wrong. ${CONTACT_SUPPORT}` }, { status: 500 });
  }

  const { data: event } = await db.from('events').select('event_name').eq('id', ticket.event_id).maybeSingle();
  const eventName = event?.event_name ?? '';

  const markFailed = (reason: string) =>
    db.from('ticket_change_refunds').update({ status: 'failed', failure_reason: reason }).eq('id', claim.id);

  // Held-funds gate — mirrors the admin refund-tickets route. In practice this
  // window only ever opens well before the event, and payouts only release
  // after it, so this should never actually trip — kept anyway because
  // refund correctness must never depend on timing working out.
  const { data: payout } = await db.from('payouts').select('id, gross, status').eq('event_id', ticket.event_id).maybeSingle();
  if (payout && (payout.status === 'completed' || payout.status === 'otp_pending')) {
    await markFailed('Payout already released');
    return NextResponse.json({ error: `This event's payout has already been released. ${CONTACT_SUPPORT}` }, { status: 400 });
  }

  const refundAmount = ticket.subtotal ?? basePriceFromTotalPaid(ticket.total_paid);

  try {
    if (refundAmount > 0) {
      if (!ticket.paystack_reference) {
        await markFailed('No payment reference on file');
        return NextResponse.json({ error: `Could not process this refund automatically. ${CONTACT_SUPPORT}` }, { status: 500 });
      }
      await refundTransaction({ transaction: ticket.paystack_reference, amount: refundAmount * 100 });
    }
  } catch (err) {
    const reasonMsg = err instanceof Error ? err.message : 'Paystack refund failed';
    await markFailed(reasonMsg);
    notify(
      { type: 'admin' },
      {
        notifType: 'refund',
        title: `Self-serve refund failed — ${eventName}`,
        body: `Ticket ${ticket.id}'s buyer tried to opt out after a venue/date change but Paystack refused: ${reasonMsg}`,
        link: `/admin/events/${ticket.event_id}`,
      },
      { emailChannel: 'immediate' },
    ).catch(console.error);
    return NextResponse.json({ error: `The refund could not be processed automatically. Our team has been notified — ${CONTACT_SUPPORT}` }, { status: 500 });
  }

  // Paystack has now refunded the buyer's money (or there was nothing to
  // refund for a free ticket). Every step from here must never be reported
  // back as "the refund failed" — retrying would risk a double refund.
  const nowIso = new Date().toISOString();

  const { error: ticketUpdateErr } = await db
    .from('tickets')
    .update({
      status: 'refunded',
      refunded_at: nowIso,
      refunded_by: 'buyer_self_serve',
      refund_reason: `Buyer opted out after a ${change.change_type.replace('_', ' ')} change`,
    })
    .eq('id', ticket.id);

  if (ticketUpdateErr) {
    console.error('refund-opt-out: ticket update failed after Paystack refund', ticket.id, ticketUpdateErr);
    notify(
      { type: 'admin' },
      {
        notifType: 'refund',
        title: `Refund DB update failed — ${eventName}`,
        body: `Paystack refunded ticket ${ticket.id} via self-serve opt-out but the database was not updated. Fix it manually.`,
        link: `/admin/events/${ticket.event_id}`,
      },
      { emailChannel: 'immediate' },
    ).catch(console.error);
  }

  const { error: tierErr } = await db.rpc('increment_tier_sold', { tier_id: ticket.tier_id, amount: -1 });
  if (tierErr) console.error('refund-opt-out: tier sold-count decrement failed', ticket.tier_id, tierErr);

  if (payout && refundAmount > 0) {
    const { data: org } = await db.from('users').select('platform_fee_rate').eq('id', ticket.organizer_id).maybeSingle();
    const newGross = Math.max(0, payout.gross - refundAmount);
    const { fee, net } = calculateFees(newGross, org?.platform_fee_rate);
    await db.from('payouts').update({ gross: newGross, fee, net }).eq('id', payout.id);
  }

  await db.from('ticket_change_refunds').update({ status: 'refunded', refund_amount: refundAmount, refunded_at: nowIso }).eq('id', claim.id);

  sendRefundConfirmationEmail(ticket.buyer_email, ticket.id, refundAmount, eventName).catch(err =>
    console.error('refund-opt-out: confirmation email error', ticket.id, err),
  );

  const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);
  notify(
    { type: 'organizer', id: ticket.organizer_id },
    {
      notifType: 'refund',
      title: `Buyer opted out after your change — ${eventName}`,
      body: `A buyer used the self-serve refund link after your recent change. ${fmt(refundAmount)} refunded for ticket ${ticket.id}.`,
      link: '/organizer/payouts',
    },
  ).catch(console.error);

  return NextResponse.json({ success: true, data: { refunded: true, amount: refundAmount } });
}
