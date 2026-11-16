import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getIp } from '@/lib/server/rateLimit';
import { checkTierCode, normalizeAccessCode } from '@/lib/server/tierAccess';
import { isScheduled } from '@/lib/goLive';

/**
 * Buyer enters a promo code on a code-gated tier card. Answers only "it works"
 * or "it doesn't": codes are never listed or returned. Checkout checks the
 * code again itself, so a page that skips this step gains nothing.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> },
) {
  try {
    const { id: eventId, tierId } = await params;
    const { code } = await req.json().catch(() => ({})) as { code?: unknown };
    const db = getServerSupabase();

    const { data: tier } = await db
      .from('ticket_tiers')
      .select('id, name, requires_code, allowed_email_domains, hidden, event:events!inner(id, status, goes_live_at)')
      .eq('id', tierId)
      .eq('event_id', eventId)
      .maybeSingle();

    const ev = tier && (Array.isArray(tier.event) ? tier.event[0] : tier.event) as { id: string; status: string; goes_live_at: string | null } | null;
    if (!tier || tier.hidden || !ev || ev.status !== 'approved' || isScheduled(ev.goes_live_at)) {
      return NextResponse.json({ error: 'This ticket isn’t on sale' }, { status: 404 });
    }
    if (!tier.requires_code) return NextResponse.json({ success: true, data: { code: null } });

    const res = await checkTierCode(db, { eventId, tier, rawCode: code, ip: getIp(req.headers) });
    if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: res.status });

    // Echo the normalised form so the page carries the exact code to checkout.
    return NextResponse.json({ success: true, data: { code: normalizeAccessCode(code) } });
  } catch (err) {
    console.error('POST /api/events/[id]/tiers/[tierId]/unlock error', err);
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
