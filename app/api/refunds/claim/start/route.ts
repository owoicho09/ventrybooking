import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { startClaim, startNoShowClaim } from '@/lib/server/refundCases';

/**
 * Refund claim, step 1 (Refund Policy §7). Either ticket ID + refund ID (a
 * cancellation, postponement or venue change), or ticket ID + purchase email
 * (a billed act not appearing). Either way a code goes to the email the
 * ticket was bought with, so a forwarded email can't be used to claim.
 */
export async function POST(req: NextRequest) {
  if (!checkRateLimit(`refund-claim-start:${getIp(req.headers)}`, 8, 15 * 60)) {
    return NextResponse.json({ error: 'Too many attempts. Wait a few minutes and try again.' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({})) as { mode?: string; ticketId?: string; refundCode?: string; email?: string };
  const ticketId = String(body.ticketId ?? '').trim();
  if (!ticketId) return NextResponse.json({ error: 'Enter your ticket ID' }, { status: 400 });
  const db = getServerSupabase();
  try {
    const r = body.mode === 'no_show'
      ? await startNoShowClaim(db, ticketId, String(body.email ?? ''))
      : await startClaim(db, ticketId, String(body.refundCode ?? ''));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ success: true, data: r });
  } catch (err) {
    console.error('refund claim start error', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
