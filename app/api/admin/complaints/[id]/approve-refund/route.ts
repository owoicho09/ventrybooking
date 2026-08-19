import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { refundTransaction } from '@/lib/server/paystack';
import { sendRefundConfirmationEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';
import { calculateFees, basePriceFromTotalPaid } from '@/lib/server/fees';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { notes } = await req.json();

    const db = getServerSupabase();

    const { data: complaint, error: cErr } = await db
      .from('complaints')
      .select('id, ticket_id, buyer_email, event_name, status')
      .eq('id', id)
      .maybeSingle();

    if (cErr) {
      console.error('approve-refund: complaint DB error', cErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!complaint)                        return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    if (complaint.status === 'resolved')   return NextResponse.json({ error: 'Complaint already resolved' }, { status: 400 });
    if (complaint.status === 'rejected')   return NextResponse.json({ error: 'Complaint was rejected — cannot issue refund' }, { status: 400 });

    const { data: ticket, error: tErr } = await db
      .from('tickets')
      .select('id, event_id, organizer_id, total_paid, subtotal, tier_id, paystack_reference, status')
      .eq('id', complaint.ticket_id)
      .maybeSingle();

    if (tErr) {
      console.error('approve-refund: ticket DB error', tErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (ticket.status === 'refunded') {
      return NextResponse.json({ error: 'Ticket has already been refunded' }, { status: 400 });
    }

    if (!ticket.paystack_reference) {
      return NextResponse.json(
        { error: 'Ticket has no payment reference on record — cannot issue refund through Paystack' },
        { status: 400 },
      );
    }

    // Refund based on what THIS ticket actually paid, not the tier's current price.
    // Tier prices can be edited by the organizer after tickets are sold (e.g. early-bird
    // pricing that steps up over time), so re-reading ticket_tiers.price at refund time
    // refunds the wrong amount for any ticket sold before the price changed.
    // total_paid is fixed at purchase and includes the buyer's service fee and
    // processing fee on top of the ticket price. Tickets sold since the
    // processing-fee migration store the exact base price in `subtotal`;
    // older tickets fall back to reversing the (service-fee-only) total.
    const refundAmount = ticket.subtotal ?? basePriceFromTotalPaid(ticket.total_paid);

    try {
      await refundTransaction({
        transaction: ticket.paystack_reference,
        amount:      refundAmount * 100, // kobo
      });
    } catch (err) {
      console.error('approve-refund: Paystack refund error', err);
      return NextResponse.json(
        { error: 'Paystack refund request failed — please retry or process manually via the Paystack dashboard' },
        { status: 502 },
      );
    }

    const fmt = (n: number) =>
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

    // Paystack has now actually refunded the buyer's money. From this point on we must
    // NEVER treat a failure as "the refund failed" — retrying would double-refund them.
    // Instead, any DB write failure here has to be surfaced loudly (not just console.error),
    // since the DB is now out of sync with reality until someone fixes it.
    const [{ error: ticketErr }, { error: complaintErr }] = await Promise.all([
      db.from('tickets').update({ status: 'refunded' }).eq('id', ticket.id),
      db.from('complaints').update({ status: 'resolved', notes: notes || '' }).eq('id', id),
    ]);

    if (ticketErr || complaintErr) {
      console.error('approve-refund: Paystack refund succeeded but DB update failed', {
        ticketId: ticket.id, complaintId: id, ticketErr, complaintErr,
      });
      notify(
        { type: 'admin' },
        {
          notifType: 'complaint',
          title:     `Refund DB update failed — ${complaint.event_name}`,
          body:      `Paystack refunded ${fmt(refundAmount)} to ${complaint.buyer_email} for ticket ${ticket.id}, but the database record was NOT updated. Fix the ticket/complaint status manually.`,
          link:      `/admin/buyers?search=${encodeURIComponent(complaint.buyer_email)}`,
        },
      ).catch(err => console.error('approve-refund: notify (DB failure) error', err));
    }

    // Give the ticket back to inventory — increment_tier_sold accepts a negative delta,
    // so this atomically decrements both ticket_tiers.sold and events.total_sold. Only
    // do this once we know the ticket row itself was actually marked refunded above.
    if (!ticketErr) {
      const { error: tierErr } = await db.rpc('increment_tier_sold', { tier_id: ticket.tier_id, amount: -1 });
      if (tierErr) {
        console.error('approve-refund: tier sold-count decrement failed', { ticketId: ticket.id, tierErr });
      }
    }

    // Reduce the linked payout by the refunded amount, same as the full-event-cancel flow.
    const { data: payout } = await db
      .from('payouts')
      .select('id, gross')
      .eq('event_id', ticket.event_id)
      .maybeSingle();

    if (payout) {
      const { data: org } = await db
        .from('users')
        .select('platform_fee_rate')
        .eq('id', ticket.organizer_id)
        .maybeSingle();
      const newGross = Math.max(0, payout.gross - refundAmount);
      const { fee, net } = calculateFees(newGross, org?.platform_fee_rate);
      const { error: payoutErr } = await db.from('payouts').update({ gross: newGross, fee, net }).eq('id', payout.id);
      if (payoutErr) {
        console.error('approve-refund: payout adjustment failed', { ticketId: ticket.id, payoutId: payout.id, payoutErr });
      }
    }

    try {
      await sendRefundConfirmationEmail(
        complaint.buyer_email,
        complaint.ticket_id,
        refundAmount,
        complaint.event_name,
      );
    } catch (err) {
      console.error('approve-refund: confirmation email error', err);
    }

    notify(
      { type: 'admin' },
      {
        notifType: 'complaint',
        title:     `Refund processed — ${complaint.event_name}`,
        body:      `${fmt(refundAmount)} refunded to ${complaint.buyer_email} for ticket ${ticket.id}.`,
        link:      '/admin/complaints',
      },
    ).catch(err => console.error('approve-refund: notify error', err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('approve-refund error:', err);
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
  }
}
