import type { SupabaseClient } from '@supabase/supabase-js';
import { PLATFORM_FEE_RATE } from '@/lib/fees';

/**
 * The platform owner's morning report (daily, previous Lagos day) and weekly
 * report (previous Monday-Sunday). One builder for both, so they can never
 * disagree. Read-only: it only counts what the database already records.
 *
 * Money:
 *   gross          what buyers paid (total_paid, processing fee included)
 *   ventryRevenue  service fees + Ventry's commission on ticket prices
 *   organiserNet   ticket prices minus Ventry's commission
 */

export type ReportPeriod = 'day' | 'week';

export interface SalesFigures {
  tickets: number; paidTickets: number; freeTickets: number; orders: number;
  gross: number; ventryRevenue: number; organiserNet: number; buyers: number;
}

export interface AdminReport {
  period: ReportPeriod;
  label: string;            // "Sunday 15 November" / "9 – 15 November"
  start: string; end: string;
  sales: SalesFigures;
  previous: SalesFigures;   // the day (or week) before
  avg7: SalesFigures | null; // daily only: average of the 7 days before
  newBuyers: number;
  topEvents: { name: string; tickets: number; gross: number }[];
  eventsOnSale: number;
  events: {
    submitted: number; approved: number; rejected: number; cancelled: number;
    awaitingReview: number; oldestWaitHours: number | null;
    goingLiveNext24h: { name: string; at: string }[];
    happeningNext7d: { name: string; date: string; sold: number; available: number }[];
  };
  organisers: { newSignups: { name: string; email: string }[]; identityVerified: number; total: number; unverified: number; onHold: number };
  money: {
    settledCount: number; settledNet: number;
    failedSettlements: number; processingSettlements: number;
    withdrawalsRequested: number; withdrawalsRequestedAmount: number; withdrawalsPending: number;
    refundedTickets: number; refundedAmount: number;
    refundClaimsNew: number; refundCasesOpen: number; refundCasesOverdue: number;
    affiliateCommissions: number; affiliateCommissionAmount: number; newReferrals: number;
  };
  health: {
    checkoutsStarted: number; checkoutsCompleted: number;
    criticalAlerts: { title: string; at: string }[];
    emails: { sent: number; delivered: number; bounced: number; complained: number; suppressed: number; failed: number; delayed: number; reportsArriving: boolean };
    checkIns: number; invalidScans: number;
  };
  security: { newDeviceSignIns: number; signInCodesSent: number; settingsChanges: number; wrongPromoCodes: number; organiserEmailChanges: number; payoutAccountChanges: number };
  support: { complaintsNew: number; complaintsOpen: number; chatCostUsdMonth: number | null; chatCallsMonth: number | null };
  alerts: { title: string; count: number }[];
}

const DAY = 86_400_000;
/** Start of a Lagos calendar day (UTC+1, no DST). */
const lagosStart = (d: string) => new Date(`${d}T00:00:00+01:00`);
export const lagosDate = (at: Date) => at.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const addDays = (d: string, n: number) => new Date(lagosStart(d).getTime() + n * DAY + 3600_000).toISOString().slice(0, 10);

/** The day before `now` in Lagos, or the Monday that starts last week. */
export function defaultPeriodStart(period: ReportPeriod, now = new Date()): string {
  const today = lagosDate(now);
  if (period === 'day') return addDays(today, -1);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const thisMonday = addDays(today, -((dow + 6) % 7));
  return addDays(thisMonday, -7);
}

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function count(q: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count: c, error } = await q;
  if (error) throw new Error(error.message);
  return c ?? 0;
}

type TicketRow = { event_id: string; organizer_id: string; subtotal: number | null; service_fee: number | null; total_paid: number | null; buyer_email: string | null; paystack_reference: string | null; purchased_at: string };

function salesOf(rows: TicketRow[], rate: (orgId: string) => number): SalesFigures {
  let gross = 0, ventry = 0, net = 0, paid = 0;
  for (const t of rows) {
    const sub = Number(t.subtotal ?? 0), fee = Number(t.service_fee ?? 0), r = rate(t.organizer_id);
    gross += Number(t.total_paid ?? 0);
    ventry += fee + sub * r;
    net += sub * (1 - r);
    if (Number(t.total_paid ?? 0) > 0) paid++;
  }
  return {
    tickets: rows.length, paidTickets: paid, freeTickets: rows.length - paid,
    orders: new Set(rows.map(t => t.paystack_reference ?? `${t.purchased_at}`)).size,
    gross: Math.round(gross), ventryRevenue: Math.round(ventry), organiserNet: Math.round(net),
    buyers: new Set(rows.map(t => (t.buyer_email ?? '').toLowerCase()).filter(Boolean)).size,
  };
}

function scale(s: SalesFigures, by: number): SalesFigures {
  const r = (n: number) => Math.round(n / by);
  return { tickets: r(s.tickets), paidTickets: r(s.paidTickets), freeTickets: r(s.freeTickets), orders: r(s.orders), gross: r(s.gross), ventryRevenue: r(s.ventryRevenue), organiserNet: r(s.organiserNet), buyers: r(s.buyers) };
}

export async function buildAdminReport(db: SupabaseClient, period: ReportPeriod, startDate: string): Promise<AdminReport> {
  const days = period === 'day' ? 1 : 7;
  const startD = lagosStart(startDate), endD = new Date(startD.getTime() + days * DAY);
  const start = startD.toISOString(), end = endD.toISOString();
  // Comparison window: the previous period (and, for a day, the 7 before it).
  // A day compares with the 7 days before it; a week with the week before.
  const histStart = new Date(startD.getTime() - 7 * DAY).toISOString();
  const nowIso = new Date().toISOString();
  const in7d = new Date(Date.now() + 7 * DAY).toISOString();

  const tickets = await all<TicketRow>((f, t) => db.from('tickets')
    .select('event_id, organizer_id, subtotal, service_fee, total_paid, buyer_email, paystack_reference, purchased_at')
    .gte('purchased_at', histStart).lt('purchased_at', end).order('purchased_at').range(f, t));

  const orgIds = [...new Set(tickets.map(t => t.organizer_id))];
  const rates = new Map<string, number>();
  if (orgIds.length) {
    const { data } = await db.from('users').select('id, platform_fee_rate').in('id', orgIds);
    for (const u of data ?? []) rates.set(u.id, u.platform_fee_rate ?? PLATFORM_FEE_RATE);
  }
  const rate = (id: string) => rates.get(id) ?? PLATFORM_FEE_RATE;

  const inPeriod = tickets.filter(t => t.purchased_at >= start);
  const before = tickets.filter(t => t.purchased_at < start);
  const prevStart = new Date(startD.getTime() - days * DAY).toISOString();
  const sales = salesOf(inPeriod, rate);
  const previous = salesOf(before.filter(t => t.purchased_at >= prevStart), rate);
  const avg7 = period === 'day' ? scale(salesOf(before, rate), 7) : null;

  // New buyers: emails buying in the period with no earlier ticket at all.
  const periodEmails = [...new Set(inPeriod.map(t => (t.buyer_email ?? '').toLowerCase()).filter(Boolean))];
  let newBuyers = periodEmails.length;
  for (let i = 0; i < periodEmails.length; i += 200) {
    const chunk = periodEmails.slice(i, i + 200);
    const { data } = await db.from('tickets').select('buyer_email').in('buyer_email', chunk).lt('purchased_at', start).limit(1000);
    newBuyers -= new Set((data ?? []).map(r => String(r.buyer_email).toLowerCase())).size;
  }

  // Top events in the period.
  const byEvent = new Map<string, { tickets: number; gross: number }>();
  for (const t of inPeriod) {
    const e = byEvent.get(t.event_id) ?? { tickets: 0, gross: 0 };
    e.tickets++; e.gross += Number(t.total_paid ?? 0);
    byEvent.set(t.event_id, e);
  }
  const topIds = [...byEvent.entries()].sort((a, b) => b[1].tickets - a[1].tickets).slice(0, 8);
  const names = new Map<string, string>();
  if (topIds.length) {
    const { data } = await db.from('events').select('id, event_name').in('id', topIds.map(([id]) => id));
    for (const e of data ?? []) names.set(e.id, e.event_name);
  }
  const topEvents = topIds.map(([id, v]) => ({ name: names.get(id) ?? 'Event', tickets: v.tickets, gross: Math.round(v.gross) }));

  // Events pipeline.
  const [submitted, approved, rejected, cancelled, awaiting, oldest, live24, next7, onSale] = await Promise.all([
    count(db.from('events').select('id', { count: 'exact', head: true }).gte('submitted_at', start).lt('submitted_at', end)),
    count(db.from('events').select('id', { count: 'exact', head: true }).in('status', ['approved', 'completed']).gte('reviewed_at', start).lt('reviewed_at', end)),
    count(db.from('events').select('id', { count: 'exact', head: true }).eq('status', 'rejected').gte('reviewed_at', start).lt('reviewed_at', end)),
    count(db.from('refund_cases').select('id', { count: 'exact', head: true }).eq('kind', 'cancellation').gte('opened_at', start).lt('opened_at', end)).catch(() => 0),
    count(db.from('events').select('id', { count: 'exact', head: true }).eq('status', 'under_review')),
    db.from('events').select('submitted_at, created_at').eq('status', 'under_review').order('submitted_at', { ascending: true, nullsFirst: true }).limit(1).maybeSingle(),
    db.from('events').select('event_name, goes_live_at').eq('status', 'approved').gt('goes_live_at', nowIso).lt('goes_live_at', new Date(Date.now() + DAY).toISOString()).order('goes_live_at').limit(10),
    db.from('events').select('event_name, date, tiers:ticket_tiers(available, sold)').eq('status', 'approved').gte('date', lagosDate(new Date())).lte('date', lagosDate(new Date(in7d))).order('date').limit(15),
    count(db.from('events').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('date', lagosDate(new Date()))),
  ]);
  const oldestAt = oldest.data ? (oldest.data.submitted_at ?? oldest.data.created_at) : null;

  // Organisers.
  const [signups, verified, totalOrgs, unverified, onHold] = await Promise.all([
    db.from('users').select('name, email').gte('created_at', start).lt('created_at', end).order('created_at').limit(50),
    count(db.from('users').select('id', { count: 'exact', head: true }).gte('identity_verified_at', start).lt('identity_verified_at', end)),
    count(db.from('users').select('id', { count: 'exact', head: true })),
    count(db.from('users').select('id', { count: 'exact', head: true }).neq('identity_status', 'verified')),
    count(db.from('users').select('id', { count: 'exact', head: true }).eq('settlement_hold', true)),
  ]);

  // Money out.
  const [settled, failedS, processingS, wReq, wPending, refunded, claimsNew, casesOpen, casesOverdue, commissions, referrals] = await Promise.all([
    db.from('settlements').select('net').eq('status', 'successful').gte('settled_at', start).lt('settled_at', end),
    count(db.from('settlements').select('id', { count: 'exact', head: true }).eq('status', 'failed')),
    count(db.from('settlements').select('id', { count: 'exact', head: true }).in('status', ['processing', 'otp_pending'])),
    db.from('withdrawal_requests').select('amount').gte('requested_at', start).lt('requested_at', end),
    count(db.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    db.from('tickets').select('total_paid').eq('status', 'refunded').gte('refunded_at', start).lt('refunded_at', end),
    count(db.from('refund_claims').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end)),
    count(db.from('refund_cases').select('id', { count: 'exact', head: true }).in('status', ['verifying', 'open', 'list_sent'])),
    count(db.from('refund_cases').select('id', { count: 'exact', head: true }).not('overdue_flagged_at', 'is', null).in('status', ['verifying', 'open', 'list_sent'])),
    db.from('platform_affiliate_commissions').select('commission_amount').gte('created_at', start).lt('created_at', end),
    count(db.from('platform_affiliate_referrals').select('id', { count: 'exact', head: true }).gte('referred_at', start).lt('referred_at', end)),
  ]);

  // Health.
  const [started, completed, crit, mails, scans] = await Promise.all([
    count(db.from('pending_orders').select('reference', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end)),
    count(db.from('purchases').select('paystack_reference', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end)),
    db.from('notifications').select('title, created_at').eq('recipient_type', 'admin').gte('created_at', start).lt('created_at', end).order('created_at'),
    all<{ status: string }>((f, t) => db.from('email_deliveries').select('status').gte('created_at', start).lt('created_at', end).range(f, t)),
    all<{ result: string }>((f, t) => db.from('scan_logs').select('result').gte('scanned_at', start).lt('scanned_at', end).range(f, t)),
  ]);
  const mailCount = (s: string) => mails.filter(m => m.status === s).length;
  const { isCriticalAdminAlert } = await import('@/lib/server/notify');
  const adminRows = (crit.data ?? []) as { title: string; created_at: string }[];
  const alertGroups = new Map<string, number>();
  for (const r of adminRows) {
    const key = r.title.split(/\s[—:-]\s|: /)[0].trim();
    alertGroups.set(key, (alertGroups.get(key) ?? 0) + 1);
  }

  // Security.
  const [codesSent, newDevices, settingsGrants, promoWrong, emailChanges, payoutChanges] = await Promise.all([
    count(db.from('organizer_login_challenges').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end)),
    count(db.from('organizer_login_challenges').select('id', { count: 'exact', head: true }).not('consumed_at', 'is', null).gte('created_at', start).lt('created_at', end)),
    count(db.from('organizer_change_codes').select('id', { count: 'exact', head: true }).eq('purpose', 'settings').not('verified_at', 'is', null).gte('created_at', start).lt('created_at', end)),
    count(db.from('tier_code_attempts').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end)),
    Promise.resolve(adminRows.filter(r => r.title.startsWith('Organiser changed account email')).length),
    Promise.resolve(adminRows.filter(r => r.title.startsWith('Organiser changed payout account')).length),
  ]);

  // Support.
  const month = startDate.slice(0, 7);
  const [complaintsNew, complaintsOpen, chat] = await Promise.all([
    count(db.from('complaints').select('id', { count: 'exact', head: true }).gte('submitted_at', start).lt('submitted_at', end)),
    count(db.from('complaints').select('id', { count: 'exact', head: true }).not('status', 'in', '(resolved,rejected)')),
    db.from('support_chat_usage').select('calls, cost_usd').eq('month', month).maybeSingle(),
  ]);

  const sum = (rows: { [k: string]: unknown }[] | null, k: string) => Math.round((rows ?? []).reduce((s, r) => s + Number(r[k] ?? 0), 0));
  const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
  const lastDay = addDays(startDate, days - 1);
  const label = period === 'day'
    ? fmtDay(startDate, { weekday: 'long', day: 'numeric', month: 'long' })
    : `${fmtDay(startDate, { day: 'numeric', month: 'short' })} – ${fmtDay(lastDay, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return {
    period, label, start, end,
    sales, previous, avg7, newBuyers, topEvents, eventsOnSale: onSale,
    events: {
      submitted, approved, rejected, cancelled,
      awaitingReview: awaiting,
      oldestWaitHours: oldestAt ? Math.round((Date.now() - new Date(oldestAt).getTime()) / 3600_000) : null,
      goingLiveNext24h: (live24.data ?? []).map(e => ({ name: e.event_name, at: e.goes_live_at as string })),
      happeningNext7d: (next7.data ?? []).map(e => {
        const tiers = (e.tiers ?? []) as { available: number; sold: number }[];
        return { name: e.event_name, date: String(e.date).slice(0, 10), sold: tiers.reduce((s, t) => s + t.sold, 0), available: tiers.reduce((s, t) => s + t.available, 0) };
      }),
    },
    organisers: { newSignups: (signups.data ?? []).map(u => ({ name: u.name ?? '', email: u.email })), identityVerified: verified, total: totalOrgs, unverified, onHold },
    money: {
      settledCount: (settled.data ?? []).length, settledNet: sum(settled.data, 'net'),
      failedSettlements: failedS, processingSettlements: processingS,
      withdrawalsRequested: (wReq.data ?? []).length, withdrawalsRequestedAmount: sum(wReq.data, 'amount'), withdrawalsPending: wPending,
      refundedTickets: (refunded.data ?? []).length, refundedAmount: sum(refunded.data, 'total_paid'),
      refundClaimsNew: claimsNew, refundCasesOpen: casesOpen, refundCasesOverdue: casesOverdue,
      affiliateCommissions: (commissions.data ?? []).length, affiliateCommissionAmount: sum(commissions.data, 'commission_amount'), newReferrals: referrals,
    },
    health: {
      checkoutsStarted: started, checkoutsCompleted: completed,
      criticalAlerts: adminRows.filter(r => isCriticalAdminAlert(r.title)).map(r => ({ title: r.title, at: r.created_at })).slice(0, 15),
      emails: {
        sent: mails.length, delivered: mailCount('delivered'), bounced: mailCount('bounced'), complained: mailCount('complained'),
        suppressed: mailCount('suppressed'), failed: mailCount('failed'), delayed: mailCount('delayed'),
        // Every row stuck at 'sent' means Resend's delivery reports aren't arriving.
        reportsArriving: mails.length === 0 || mails.some(m => m.status !== 'sent'),
      },
      checkIns: scans.filter(s => s.result === 'success').length,
      invalidScans: scans.filter(s => s.result !== 'success').length,
    },
    security: { newDeviceSignIns: newDevices, signInCodesSent: codesSent, settingsChanges: settingsGrants, wrongPromoCodes: promoWrong, organiserEmailChanges: emailChanges, payoutAccountChanges: payoutChanges },
    support: { complaintsNew, complaintsOpen, chatCostUsdMonth: chat.data ? Number(chat.data.cost_usd) : null, chatCallsMonth: chat.data ? chat.data.calls : null },
    alerts: [...alertGroups.entries()].sort((a, b) => b[1] - a[1]).map(([title, n]) => ({ title, count: n })),
  };
}
