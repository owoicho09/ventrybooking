import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { notify } from '@/lib/server/notify';

export async function POST(req: NextRequest) {
  // 5 refund attempts per 10 minutes per IP
  if (!checkRateLimit(`refund:${getIp(req.headers)}`, 5, 10 * 60)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }
  try {
    const { ticketId, refundCode, email, type } = await req.json();
    if (!ticketId || !refundCode || !email) {
      return NextResponse.json({ error: 'Ticket ID, refund code, and email are required' }, { status: 400 });
    }

    const db = getServerSupabase();

    // Verify ticket + refund code
    const { data: ticket } = await db
      .from('tickets')
      .select('id, buyer_email, refund_code, status, event_id, event:events!tickets_event_id_fkey(name)')
      .eq('id', ticketId.trim().toUpperCase())
      .eq('buyer_email', email.toLowerCase().trim())
      .single();

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found or email does not match' }, { status: 404 });
    }
    if (ticket.refund_code !== refundCode.trim().toUpperCase()) {
      return NextResponse.json({ error: 'Invalid refund code' }, { status: 400 });
    }
    if (ticket.status === 'refunded') {
      return NextResponse.json({ error: 'This ticket has already been refunded' }, { status: 400 });
    }

    // Check for existing open complaint
    const { data: existing } = await db
      .from('complaints')
      .select('id')
      .eq('ticket_id', ticketId)
      .in('status', ['open', 'investigating'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A complaint is already open for this ticket' }, { status: 409 });
    }

    const complaintId = `CMP-${uuidv4().slice(0, 8).toUpperCase()}`;
    const eventRaw = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;
    const eventName = (eventRaw as { name: string } | null)?.name || 'Unknown Event';

    await db.from('complaints').insert({
      id: complaintId,
      ticket_id: ticketId,
      type: type || 'Event Cancelled',
      buyer_email: email.toLowerCase().trim(),
      event_name: eventName,
      event_id: ticket.event_id,
      submitted_at: new Date().toISOString(),
      status: 'open',
      priority: type === 'Fraud' ? 'high' : 'medium',
    });

    notify(
      { type: 'admin' },
      {
        notifType: 'complaint',
        title:     `New refund complaint — ${type || 'Event Cancelled'}`,
        body:      `${email} filed a complaint for ticket ${ticketId} (${eventName}).`,
        link:      '/admin/complaints',
      },
    ).catch(console.error);

    return NextResponse.json({
      success: true,
      data: { complaintId, message: 'Your refund claim has been submitted. We will review it within 2-3 business days.' },
    });
  } catch (err) {
    console.error('POST /api/help/refund error', err);
    return NextResponse.json({ error: 'Failed to submit refund claim' }, { status: 500 });
  }
}
