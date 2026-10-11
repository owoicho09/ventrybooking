import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendDailySalesEmail, type DailySalesLine } from '@/lib/server/email';
import { PLATFORM_FEE_RATE } from '@/lib/fees';

// End-of-day sales email to organisers: how many tickets each of their
// events sold that day. No sale, no email.
//
// Schedule (external cron, like the other jobs): every day at 00:05 WAT.
// A run before 06:00 WAT reports the whole of the previous Nigerian calendar
// day, so every email covers a complete day. `?date=YYYY-MM-DD` overrides it
// (e.g. to re-send a missed day); `?dryRun=1` returns what would be sent
// without sending anything. Each organiser/day is sent at most once:
// the send is recorded in email_deliveries under a per-organiser, per-day
// purpose key, and a run skips anyone already recorded.

export const maxDuration = 60;

const SEND_SPACING_MS = 550;   // Resend's ~2 req/s default
const TIME_BUDGET_MS = 45_000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Calendar date in Lagos, YYYY-MM-DD. */
function lagosDay(at: Date): string {
  return at.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
}

function dayToReport(now: Date, override: string | null): string {
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  const lagosHour = Number(now.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hour12: false }));
  const today = lagosDay(now);
  if (lagosHour >= 6) return today;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const day = dayToReport(new Date(), req.nextUrl.searchParams.get('date'));
  // WAT is UTC+1 all year (no daylight saving).
  const from = `${day}T00:00:00+01:00`;
  const nextDay = new Date(`${day}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const to = `${nextDay.toISOString().slice(0, 10)}T00:00:00+01:00`;
  const dayLabel = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  try {
    const db = getServerSupabase();

    // Tickets issued that day and still standing (a ticket refunded since
    // doesn't count as sold). One row is one ticket.
    const { data: tickets, error } = await db
      .from('tickets')
      .select(`
        organizer_id, event_id, tier_id,
        tier:ticket_tiers!tickets_tier_id_fkey(name, price),
        event:events!tickets_event_id_fkey(event_name)
      `)
      .in('status', ['valid', 'used'])
      .gte('purchased_at', from)
      .lt('purchased_at', to);
    if (error) throw error;

    // organiser → (event|tier) → line
    const byOrg = new Map<string, Map<string, DailySalesLine>>();
    for (const t of (tickets ?? []) as unknown as {
      organizer_id: string; event_id: string; tier_id: string;
      tier: { name: string; price: number } | { name: string; price: number }[] | null;
      event: { event_name: string } | { event_name: string }[] | null;
    }[]) {
      const tier = Array.isArray(t.tier) ? t.tier[0] : t.tier;
      const event = Array.isArray(t.event) ? t.event[0] : t.event;
      const price = Number(tier?.price ?? 0);
      const lines = byOrg.get(t.organizer_id) ?? new Map<string, DailySalesLine>();
      const key = `${t.event_id}|${t.tier_id}`;
      const line = lines.get(key) ?? { eventName: event?.event_name?.trim() || 'Your event', tierName: tier?.name ?? 'Ticket', paid: 0, free: 0, value: 0 };
      if (price > 0) { line.paid += 1; line.value += price; } else { line.free += 1; }
      lines.set(key, line);
      byOrg.set(t.organizer_id, lines);
    }

    if (byOrg.size === 0) {
      return NextResponse.json({ success: true, day, organizers: 0, sent: 0 });
    }

    const orgIds = [...byOrg.keys()];
    const purposeOf = (id: string) => `daily_sales:${id}:${day}`;
    const [{ data: orgs }, { data: already }] = await Promise.all([
      db.from('users').select('id, name, email, platform_fee_rate').in('id', orgIds),
      db.from('email_deliveries').select('purpose').in('purpose', orgIds.map(purposeOf)),
    ]);
    const sentBefore = new Set((already ?? []).map((r: { purpose: string }) => r.purpose));

    if (req.nextUrl.searchParams.get('dryRun') === '1') {
      return NextResponse.json({
        success: true, day, dryRun: true,
        organizers: ((orgs ?? []) as { id: string; name: string | null; email: string | null }[]).map(o => ({
          id: o.id,
          name: o.name,
          hasEmail: !!o.email,
          alreadySent: sentBefore.has(purposeOf(o.id)),
          lines: [...(byOrg.get(o.id)?.values() ?? [])],
        })),
      });
    }

    let sent = 0;
    let skipped = 0;
    const failed: string[] = [];
    let lastSendAt = 0;
    for (const org of (orgs ?? []) as { id: string; name: string | null; email: string | null; platform_fee_rate: number | null }[]) {
      if (!org.email || sentBefore.has(purposeOf(org.id))) { skipped += 1; continue; }
      if (Date.now() - started > TIME_BUDGET_MS) break;
      const wait = SEND_SPACING_MS - (Date.now() - lastSendAt);
      if (wait > 0) await sleep(wait);
      lastSendAt = Date.now();
      try {
        const lines = [...byOrg.get(org.id)!.values()].sort((a, b) => a.eventName.localeCompare(b.eventName) || (b.paid + b.free) - (a.paid + a.free));
        await sendDailySalesEmail({
          to: org.email,
          organizerName: org.name?.trim() || 'there',
          dayLabel,
          lines,
          feeRate: org.platform_fee_rate ?? PLATFORM_FEE_RATE,
          purpose: purposeOf(org.id),
        });
        sent += 1;
      } catch (e) {
        console.error('daily-sales: send failed', org.id, e);
        failed.push(org.id);
      }
    }

    return NextResponse.json({ success: true, day, organizers: byOrg.size, sent, skipped, failed: failed.length });
  } catch (err) {
    console.error('GET /api/cron/daily-sales error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
