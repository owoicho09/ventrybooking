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

    // --- Resolve the ticket ID from whatever format the QR carries ---
    //
    // New tickets encode only the ticket ID (e.g. "TKT-WGMT-H2LC").
    // Tickets issued before this change encode a signed JWT (three dot-separated
    // segments). We detect the format by the presence of dots and handle both so
    // that already-issued tickets keep working at the door.
    let ticketId: string;

    if (qrToken.includes('.')) {
      // Legacy path: JWT — verify signature, then extract the ticket ID.
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
      // JWTs carry the event ID — use it as an extra integrity check.
      if (payload.eventId !== eventId) {
        await logScan(user.sub, eventId, payload.ticketId, 'Unknown', 'Unknown', 'invalid');
        return NextResponse.json({
          success: true,
          data: { result: 'invalid', reason: 'Ticket is for a different event' },
        });
      }
      ticketId = payload.ticketId;
    } else {
      // New path: plain ticket ID.
      ticketId = qrToken.trim();
    }

    const db = getServerSupabase();

    // --- Database checks ---

    const { data: ticket } = await db
      .from('tickets')
      .select(`
        id, status, event_id, buyer_name,
        tier:ticket_tiers!tickets_tier_id_fkey(name),
        event:events!tickets_event_id_fkey(date)
      `)
      .eq('id', ticketId)
      .single();

    // Check 1: ticket exists
    if (!ticket) {
      await logScan(user.sub, eventId, ticketId, 'Unknown', 'Unknown', 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Ticket not found' },
      });
    }

    const tierName = (Array.isArray(ticket.tier) ? ticket.tier[0] : ticket.tier as { name: string } | null)?.name ?? 'Unknown';

    // Check 2: ticket belongs to the selected event
    if (ticket.event_id !== eventId) {
      await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, tierName, 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Ticket is for a different event' },
      });
    }

    // Check 3: already scanned
    if (ticket.status === 'used') {
      await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, tierName, 'already_used');
      return NextResponse.json({
        success: true,
        data: { result: 'already_used', attendeeName: ticket.buyer_name, ticketType: tierName },
      });
    }

    // Check 4: must be in a scannable state
    if (ticket.status !== 'valid') {
      await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, tierName, 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: `Ticket status is ${ticket.status}` },
      });
    }

    // Check 5: event not expired more than 24 h ago
    const eventRaw  = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;
    const eventDate = new Date((eventRaw as { date: string } | null)?.date ?? '');
    const cutoff    = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
    if (new Date() > cutoff) {
      await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, tierName, 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Event has expired' },
      });
    }

    // All checks passed — mark as used
    await db.from('tickets').update({ status: 'used' }).eq('id', ticket.id);
    await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, tierName, 'success');

    return NextResponse.json({
      success: true,
      data: {
        result:       'success',
        attendeeName: ticket.buyer_name,
        ticketType:   tierName,
        ticketId:     ticket.id,
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
      event_id:      eventId,
      ticket_id:     ticketId,
      attendee_name: attendeeName,
      ticket_type:   ticketType,
      scanned_at:    new Date().toISOString(),
      scanned_by:    scannedBy,
      result,
    });
  } catch (e) { console.error(e); }
}
