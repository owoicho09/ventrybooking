import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { refundTransaction } from '@/lib/server/paystack';
import { sendRefundConfirmationEmail } from '@/lib/server/email';
import { SERVICE_FEE } from '@/lib/server/fees';

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

    const { data: ticket, error: tErr } = await db
      .from('tickets')
      .select('id, total_paid, paystack_reference, status')
      .eq('id', complaint.ticket_id)
      .maybeSingle();

    if (tErr) {
      console.error('approve-refund: ticket DB error', tErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    // Refund = total_paid minus the non-refundable service fee
    const refundAmount = Math.max(0, ticket.total_paid - SERVICE_FEE);

    if (ticket.paystack_reference) {
      try {
        // Paystack accepts either the transaction reference or numeric ID
        await refundTransaction({
          transaction: ticket.paystack_reference,
          amount:      refundAmount * 100, // kobo
        });
      } catch (err) {
        console.error('Paystack refund error (non-fatal):', err);
        // Log but don't block — admin still marks it as resolved
      }
    }

    await Promise.all([
      db.from('tickets').update({ status: 'refunded' }).eq('id', ticket.id),
      db.from('complaints').update({ status: 'resolved', notes: notes || '' }).eq('id', id),
    ]);

    sendRefundConfirmationEmail(
      complaint.buyer_email,
      complaint.ticket_id,
      refundAmount,
      complaint.event_name,
    ).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('approve-refund error:', err);
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
  }
}
