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
    // eventId is optional:
    //   provided  → manual-input path; ticket must belong to the selected event
    //   omitted   → URL-scan path;     ticket must belong to the logged-in organizer
    const { qrToken, eventId } = await req.json() as { qrToken?: string; eventId?: string };

    if (!qrToken) {
      return NextResponse.json({ error: 'QR token required' }, { status: 400 });
    }

    // --- Resolve ticket ID (legacy JWT compat) ---
    let ticketId: string;

    if (qrToken.includes('.')) {
      // Legacy: signed JWT — verify signature then extract the ticket ID
      let payload: { ticketId: string; eventId: string };
      try {
        payload = verifyQrToken(qrToken);
      } catch {
        // No valid eventId available — skip audit log to avoid FK violation
        if (eventId) {
          await logScan(user.sub, eventId, 'INVALID', 'Unknown', 'Unknown', 'invalid');
        }
        return NextResponse.json({
          success: true,
          data: { result: 'invalid', reason: 'Invalid QR code signature' },
        });
      }
      if (eventId && payload.eventId !== eventId) {
        await logScan(user.sub, eventId, payload.ticketId, 'Unknown', 'Unknown', 'invalid');
        return NextResponse.json({
          success: true,
          data: { result: 'invalid', reason: 'Ticket is for a different event' },
        });
      }
      ticketId = payload.ticketId;
    } else {
      // New format: plain ticket ID
      ticketId = qrToken.trim();
    }

    const db = getServerSupabase();

    const { data: ticket } = await db
      .from('tickets')
      .select(`
        id, status, event_id, organizer_id, buyer_name,
        tier:ticket_tiers!tickets_tier_id_fkey(name),
        event:events!tickets_event_id_fkey(date, event_name)
      `)
      .eq('id', ticketId)
      .single();

    // Check 1: ticket exists
    if (!ticket) {
      // Only log when we have a valid event UUID — 'UNKNOWN' would violate the FK constraint
      if (eventId) {
        await logScan(user.sub, eventId, ticketId, 'Unknown', 'Unknown', 'invalid');
      }
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Ticket not found' },
      });
    }

    const tierRow  = Array.isArray(ticket.tier)  ? ticket.tier[0]  : ticket.tier  as { name: string } | null;
    const eventRow = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event as { date: string; event_name: string } | null;
    const tierName  = tierRow?.name  ?? 'Unknown';
    const eventName = eventRow?.event_name ?? '';
    const logEventId = eventId ?? ticket.event_id;

    // Check 2: correct event / organizer ownership
    if (eventId) {
      // Manual path: ticket must belong to the selected event
      if (ticket.event_id !== eventId) {
        await logScan(user.sub, eventId, ticket.id, ticket.buyer_name, tierName, 'invalid');
        return NextResponse.json({
          success: true,
          data: { result: 'invalid', reason: 'Ticket is for a different event' },
        });
      }
    } else {
      // URL-scan path: ticket must belong to the logged-in organizer
      if (ticket.organizer_id !== user.sub) {
        await logScan(user.sub, ticket.event_id, ticket.id, ticket.buyer_name, tierName, 'invalid');
        return NextResponse.json({
          success: true,
          data: { result: 'invalid', reason: 'Ticket is for a different event' },
        });
      }
    }

    // Check 3: already used
    if (ticket.status === 'used') {
      // Write the audit entry before the extra lookup so it's never lost
      await logScan(user.sub, logEventId, ticket.id, ticket.buyer_name, tierName, 'already_used');

      // Retrieve first-scan timestamp for display (best-effort; failure doesn't block the response)
      const { data: firstScan } = await db
        .from('scan_logs')
        .select('scanned_at')
        .eq('ticket_id', ticket.id)
        .eq('result', 'success')
        .order('scanned_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        data: {
          result:         'already_used',
          attendeeName:   ticket.buyer_name,
          ticketType:     tierName,
          eventName,
          firstScannedAt: firstScan?.scanned_at ?? null,
        },
      });
    }

    // Check 4: must be in a scannable state
    if (ticket.status !== 'valid') {
      await logScan(user.sub, logEventId, ticket.id, ticket.buyer_name, tierName, 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: `Ticket status is ${ticket.status}` },
      });
    }

    // Check 5: event not expired more than 24 h ago
    // Guard: if the event row is missing (e.g. deleted after ticket was issued),
    // treat it as expired rather than silently letting new Date('') produce NaN
    // which makes the > comparison always false and bypasses this check entirely.
    if (!eventRow?.date) {
      await logScan(user.sub, logEventId, ticket.id, ticket.buyer_name, tierName, 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Event information unavailable' },
      });
    }
    const eventDate = new Date(eventRow.date);
    const cutoff    = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
    if (new Date() > cutoff) {
      await logScan(user.sub, logEventId, ticket.id, ticket.buyer_name, tierName, 'invalid');
      return NextResponse.json({
        success: true,
        data: { result: 'invalid', reason: 'Event has expired' },
      });
    }

    // All checks passed — mark as used
    await db.from('tickets').update({ status: 'used' }).eq('id', ticket.id);
    await logScan(user.sub, logEventId, ticket.id, ticket.buyer_name, tierName, 'success');

    return NextResponse.json({
      success: true,
      data: {
        result:       'success',
        attendeeName: ticket.buyer_name,
        ticketType:   tierName,
        eventName,
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
