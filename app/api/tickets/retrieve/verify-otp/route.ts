import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';

function hashOTP(otp: string, email: string): string {
  return createHash('sha256').update(otp + email).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();
    const normalized = String(email ?? '').trim().toLowerCase();
    const submitted = String(otp ?? '').trim();

    if (!normalized || !/^\d{4}$/.test(submitted)) {
      return NextResponse.json({ error: 'Enter the 4-digit code sent to your email' }, { status: 400 });
    }

    const ip = getIp(req.headers);
    if (
      !checkRateLimit(`ticket-otp-verify:${normalized}`, 5, 10 * 60) ||
      !checkRateLimit(`ticket-otp-verify-ip:${ip}`, 15, 10 * 60)
    ) {
      return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
    }

    const db = getServerSupabase();
    const { data: otpRow, error: otpErr } = await db
      .from('ticket_lookup_otps')
      .select('id, otp_hash, expires_at')
      .eq('email', normalized)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpErr) {
      console.error('verify-otp lookup error', otpErr);
      return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
    }

    // "No code exists for this email" (because it has no tickets, so
    // request-otp never sent one) and "wrong/expired code" must read
    // identically — otherwise this endpoint becomes an email-enumeration
    // oracle for anyone who skips straight to verify-otp with a guess.
    const INVALID = NextResponse.json({ error: 'Incorrect or expired code. Request a new one.' }, { status: 400 });

    if (!otpRow) return INVALID;
    if (new Date(otpRow.expires_at) < new Date()) {
      await db.from('ticket_lookup_otps').delete().eq('id', otpRow.id);
      return INVALID;
    }
    if (hashOTP(submitted, normalized) !== otpRow.otp_hash) {
      return INVALID;
    }

    // Single-use — burn it immediately on success so it can't be replayed.
    await db.from('ticket_lookup_otps').delete().eq('id', otpRow.id);

    const { data, error } = await db
      .from('tickets')
      .select(`
        id, status, purchased_at,
        event:events!tickets_event_id_fkey(event_name, date)
      `)
      .ilike('buyer_email', normalized)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('verify-otp ticket lookup error', error);
      return NextResponse.json({ error: 'Failed to retrieve tickets' }, { status: 500 });
    }

    type EvRow = { event_name: string; date: string };
    const tickets = (data ?? []).map(t => {
      const ev = (Array.isArray(t.event) ? t.event[0] : t.event) as EvRow | null;
      return {
        id: t.id,
        status: t.status,
        eventName: ev?.event_name ?? '',
        eventDate: ev?.date ?? '',
      };
    });

    return NextResponse.json({ success: true, data: tickets });
  } catch (err) {
    console.error('POST /api/tickets/retrieve/verify-otp error', err);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
