import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyTicketLink } from '@/lib/server/ticketLinks';
import { signAuthToken } from '@/lib/server/jwt';
import { buyerCookieOptions } from '@/lib/server/buyerAuth';

// One-tap buyer session from a link mailed to a purchase's own email address
// (post-checkout success banner, ticket email footer) — the purchase itself
// is the proof of ownership, so this skips the OTP round trip entirely.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';

  let payload;
  try {
    payload = verifyTicketLink(token);
  } catch {
    return NextResponse.redirect(new URL('/account/login', req.url));
  }
  if (payload.purpose !== 'buyer_claim') {
    return NextResponse.redirect(new URL('/account/login', req.url));
  }

  const db = getServerSupabase();
  const { data: ticket } = await db
    .from('tickets')
    .select('buyer_email')
    .eq('id', payload.ticketId)
    .maybeSingle();

  if (!ticket) {
    return NextResponse.redirect(new URL('/account/login', req.url));
  }

  const email = ticket.buyer_email.trim().toLowerCase();
  const authToken = signAuthToken({ sub: email, role: 'buyer', email });
  const res = NextResponse.redirect(new URL('/account', req.url));
  res.cookies.set({ ...buyerCookieOptions(30 * 24 * 60 * 60), value: authToken });
  return res;
}
