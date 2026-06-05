import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyQrToken } from '@/lib/server/jwt';

export async function POST(req: NextRequest) {
  const db = getServerSupabase();

  // ── Resolve caller identity ──────────────────────────────────────
  // Two valid auth paths:
  //   1. Organizer session cookie  → user.role === 'organizer'
  //   2. Staff code in request body → validated against staff_ids table

  const user = await getAuthUser();
  const body = await req.json() as {
    qrToken?:   string;
    eventId?:   string;
    staffCode?: string;
  };

  const { qrToken, eventId, staffCode } = body;

  if (!qrToken) {
    return NextResponse.json({ error: 'QR token required' }, { status: 400 });
  }

  // Which organizer (user ID or staff ID UUID) is performing this scan?
  let scannedByUserId: string | null = null;
  let scannedByStaffId: string | null = null;
  // Event ID restriction imposed by the staff code (null = organizer path, unrestricted per-event)
  let staffEventId: string | null = null;

  if (user && user.role === 'organizer') {
    scannedByUserId = user.sub;
  } else if (staffCode) {
    // Staff code path — validate without a user session
    const code = staffCode.trim().toUpperCase();
    const { data: staff } = await db
      .from('staff_ids')
      .select('id, active, expires_at, event_id, organizer_id')
      .eq('code', code)
      .maybeSingle();

    if (!staff || !staff.active || new Date() > new Date(staff.expires_at)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    scannedByStaffId = staff.id;
    staffEventId     = staff.event_id;
  } else {
    // Third path: HttpOnly cookie set by /api/staff/session.
    // SFSafariViewController shares Safari's cookie jar, so cookies set when
    // staff visited their setup link in Safari are present on every subsequent
    // Camera-opened scan URL — no localStorage or client state needed.
    const cookieCode = req.cookies.get('ventry_staff')?.value?.trim().toUpperCase();
    if (cookieCode) {
      const { data: staff } = await db
        .from('staff_ids')
        .select('id, active, expires_at, event_id')
        .eq('code', cookieCode)
        .maybeSingle();

      if (!staff || !staff.active || new Date() > new Date(staff.expires_at)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      scannedByStaffId = staff.id;
      staffEventId     = staff.event_id;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // ── Resolve ticket ID (legacy JWT compat) ────────────────────────
    let ticketId: string;

    if (qrToken.includes('.')) {
      let payload: { ticketId: string; eventId: string };
      try {
        payload = verifyQrToken(qrToken);
      } catch {
        if (eventId) await logScan({ scannedByUserId, scannedByStaffId, eventId, ticketId: 'INVALID', attendeeName: 'Unknown', ticketType: 'Unknown', result: 'invalid' });
        return NextResponse.json({ success: true, data: { result: 'invalid', reason: 'Invalid QR code signature' } });
      }
      if (eventId && payload.eventId !== eventId) {
        await logScan({ scannedByUserId, scannedByStaffId, eventId, ticketId: payload.ticketId, attendeeName: 'Unknown', ticketType: 'Unknown', result: 'invalid' });
        return NextResponse.json({ success: true, data: { result: 'invalid', reason: 'Ticket is for a different event' } });
      }
      ticketId = payload.ticketId;
    } else {
      ticketId = qrToken.trim();
    }

    // ── Fetch ticket ─────────────────────────────────────────────────
    const { data: ticket } = await db
      .from('tickets')
      .select(`
        id, status, event_id, organizer_id, buyer_name,
        tier:ticket_tiers!tickets_tier_id_fkey(name),
        event:events!tickets_event_id_fkey(date, event_name)
      `)
      .eq('id', ticketId)
      .single();

    if (!ticket) {
      if (eventId) await logScan({ scannedByUserId, scannedByStaffId, eventId, ticketId, attendeeName: 'Unknown', ticketType: 'Unknown', result: 'invalid' });
      return NextResponse.json({ success: true, data: { result: 'invalid', reason: 'Ticket not found' } });
    }

    const tierRow  = Array.isArray(ticket.tier)  ? ticket.tier[0]  : ticket.tier  as { name: string } | null;
    const eventRow = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event as { date: string; event_name: string } | null;
    const tierName  = tierRow?.name       ?? 'Unknown';
    const eventName = eventRow?.event_name ?? '';
    const logEventId = staffEventId ?? eventId ?? ticket.event_id;

    // ── Check 2: correct event / ownership ──────────────────────────
    if (staffEventId) {
      // Staff path: staff code must be for the same event as the ticket
      if (ticket.event_id !== staffEventId) {
        await logScan({ scannedByUserId, scannedByStaffId, eventId: staffEventId, ticketId: ticket.id, attendeeName: ticket.buyer_name, ticketType: tierName, result: 'invalid' });
        return NextResponse.json({ success: true, data: { result: 'invalid', reason: 'Ticket is for a different event' } });
      }
    } else if (eventId) {
      // Manual organizer path: ticket must belong to the selected event
      if (ticket.event_id !== eventId) {
        await logScan({ scannedByUserId, scannedByStaffId, eventId, ticketId: ticket.id, attendeeName: ticket.buyer_name, ticketType: tierName, result: 'invalid' });
        return NextResponse.json({ success: true, data: { result: 'invalid', reason: 'Ticket is for a different event' } });
      }
    } else {
      // URL-scan organizer path: ticket must belong to the organizer
      if (scannedByUserId && ticket.organizer_id !== scannedByUserId) {
        await logScan({ scannedByUserId, scannedByStaffId, eventId: ticket.event_id, ticketId: ticket.id, attendeeName: ticket.buyer_name, ticketType: tierName, result: 'invalid' });
        return NextResponse.json({ success: true, data: { result: 'invalid', reason: 'Ticket is for a different event' } });
      }
    }

    // ── Check 3: already used ────────────────────────────────────────
    if (ticket.status === 'used') {
      await logScan({ scannedByUserId, scannedByStaffId, eventId: logEventId, ticketId: ticket.id, attendeeName: ticket.buyer_name, ticketType: tierName, result: 'already_used' });

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
        data: { result: 'already_used', attendeeName: ticket.buyer_name, ticketType: tierName, eventName, firstScannedAt: firstScan?.scanned_at ?? null },
      });
    }

    // ── Check 4: status must be valid ────────────────────────────────
    if (ticket.status !== 'valid') {
      await logScan({ scannedByUserId, scannedByStaffId, eventId: logEventId, ticketId: ticket.id, attendeeName: ticket.buyer_name, ticketType: tierName, result: 'invalid' });
      return NextResponse.json({ success: true, data: { result: 'invalid', reason: `Ticket status is ${ticket.status}` } });
    }

    // ── Check 5: event not expired ───────────────────────────────────
    if (!eventRow?.date) {
      await logScan({ scannedByUserId, scannedByStaffId, eventId: logEventId, ticketId: ticket.id, attendeeName: ticket.buyer_name, ticketType: tierName, result: 'invalid' });
      return NextResponse.json({ success: true, data: { result: 'invalid', reason: 'Event information unavailable' } });
    }
    const cutoff = new Date(new Date(eventRow.date).getTime() + 24 * 60 * 60 * 1000);
    if (new Date() > cutoff) {
      await logScan({ scannedByUserId, scannedByStaffId, eventId: logEventId, ticketId: ticket.id, attendeeName: ticket.buyer_name, ticketType: tierName, result: 'invalid' });
      return NextResponse.json({ success: true, data: { result: 'invalid', reason: 'Event has expired' } });
    }

    // ── Atomic status update ─────────────────────────────────────────
    // The WHERE status='valid' clause makes this atomic: if two concurrent
    // scan requests both pass the checks above, only one UPDATE will match
    // (Postgres serialises the writes). The second gets 0 rows back and is
    // treated as already_used rather than a false success.
    const { data: updated } = await db
      .from('tickets')
      .update({ status: 'used' })
      .eq('id', ticket.id)
      .eq('status', 'valid')
      .select('id');

    if (!updated || updated.length === 0) {
      // A concurrent scan won the race — treat as already used
      await logScan({ scannedByUserId, scannedByStaffId, eventId: logEventId, ticketId: ticket.id, attendeeName: ticket.buyer_name, ticketType: tierName, result: 'already_used' });
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
        data: { result: 'already_used', attendeeName: ticket.buyer_name, ticketType: tierName, eventName, firstScannedAt: firstScan?.scanned_at ?? null },
      });
    }

    await logScan({ scannedByUserId, scannedByStaffId, eventId: logEventId, ticketId: ticket.id, attendeeName: ticket.buyer_name, ticketType: tierName, result: 'success' });

    return NextResponse.json({
      success: true,
      data: { result: 'success', attendeeName: ticket.buyer_name, ticketType: tierName, eventName, ticketId: ticket.id },
    });
  } catch (err) {
    console.error('POST /api/organizer/scan error', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}

async function logScan(p: {
  scannedByUserId:  string | null;
  scannedByStaffId: string | null;
  eventId:     string;
  ticketId:    string;
  attendeeName: string;
  ticketType:  string;
  result:      'success' | 'already_used' | 'invalid';
}) {
  const db = getServerSupabase();
  try {
    await db.from('scan_logs').insert({
      event_id:      p.eventId,
      ticket_id:     p.ticketId,
      attendee_name: p.attendeeName,
      ticket_type:   p.ticketType,
      scanned_at:    new Date().toISOString(),
      scanned_by:    p.scannedByUserId,
      staff_id:      p.scannedByStaffId,
      result:        p.result,
    });
  } catch (e) { console.error(e); }
}
