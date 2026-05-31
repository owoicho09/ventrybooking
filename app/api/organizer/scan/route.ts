import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyQrToken } from '@/lib/server/jwt';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { qrToken, eventId } = await req.json();
    if (!qrToken || !eventId) {
      return NextResponse.json({ error: 'QR token and event ID required' }, { status: 400 });
    }

    // Check 1: JWT signature valid
    let payload: { ticketId: string; eventId: string };
    try {
      payload = verifyQrToken(qrToken);
    } catch {
      await logScan(user.sub, eventId, 'INVALID', 'Unknown', 'Unknown', 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Invalid QR code signature' },
      });
    }

    const db = getServerSupabase();

    // Check 2: Ticket exists
    const { data: ticket } = await db
      .from('tickets')
      .select(`
        id, status, event_id, buyer_name,
        tier:ticket_tiers!tickets_tier_id_fkey(name),
        event:events!tickets_event_id_fkey(date)
      `)
      .eq('id', payload.ticketId)
      .single();

    if (!ticket) {
      await logScan(user.sub, eventId, payload.ticketId, 'Unknown', 'Unknown', 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Ticket not found' },
      });
    }

    // Check 3: Correct event
    if (ticket.event_id !== payload.eventId || payload.eventId !== eventId) {
      await logScan(user.sub, eventId, payload.ticketId, ticket.buyer_name, (Array.isArray(ticket.tier) ? ticket.tier[0] : ticket.tier as { name: string } | null)?.name, 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Ticket is for a different event' },
      });
    }

    // Check 4: Already used
    if (ticket.status === 'used') {
      await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, (Array.isArray(ticket.tier) ? ticket.tier[0] : ticket.tier as { name: string } | null)?.name, 'already_used');
      return NextResponse.json({
        success: true,
        data: { result: 'already_used', attendeeName: ticket.buyer_name, ticketType: (Array.isArray(ticket.tier) ? ticket.tier[0] : ticket.tier as { name: string } | null)?.name },
      });
    }

    // Check 5: Status must be valid
    if (ticket.status !== 'valid') {
      await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, (Array.isArray(ticket.tier) ? ticket.tier[0] : ticket.tier as { name: string } | null)?.name, 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: `Ticket status is ${ticket.status}` },
      });
    }

    // Check 6: Event not expired more than 24h ago
    const eventRaw = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;
    const eventDate = new Date((eventRaw as { date: string } | null)?.date ?? '');
    const cutoff = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
    if (new Date() > cutoff) {
      await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, (Array.isArray(ticket.tier) ? ticket.tier[0] : ticket.tier as { name: string } | null)?.name, 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Event has expired' },
      });
    }

    // All checks passed — mark ticket as used
    await db.from('tickets').update({ status: 'used' }).eq('id', ticket.id);
    await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, (Array.isArray(ticket.tier) ? ticket.tier[0] : ticket.tier as { name: string } | null)?.name, 'success');

    return NextResponse.json({
      success: true,
      data: {
        result: 'success',
        attendeeName: ticket.buyer_name,
        ticketType: (Array.isArray(ticket.tier) ? ticket.tier[0] : ticket.tier as { name: string } | null)?.name,
        ticketId: ticket.id,
      },
    });
  } catch (err) {
    console.error('POST /api/organizer/scan error', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}

async function logScan(
  scannedBy: string,
  eventId: string,
  ticketId: string,
  attendeeName: string,
  ticketType: string,
  result: 'success' | 'already_used' | 'invalid'
) {
  const db = getServerSupabase();
  try {
    await db.from('scan_logs').insert({
      event_id: eventId,
      ticket_id: ticketId,
      attendee_name: attendeeName,
      ticket_type: ticketType,
      scanned_at: new Date().toISOString(),
      scanned_by: scannedBy,
      result,
    });
  } catch (e) { console.error(e); }
}
