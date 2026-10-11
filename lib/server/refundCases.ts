import { createHash, randomInt } from 'crypto';
import { getServerSupabase } from '@/lib/supabase/server';
import { refundTransaction, resolveAccountName } from '@/lib/server/paystack';
import { basePriceFromTotalPaid } from '@/lib/server/fees';
import { generateClaimRefundId } from '@/lib/server/ids';
import { notify } from '@/lib/server/notify';
import { readRefundPolicy } from '@/lib/refundPolicy';
import { eventStart } from '@/lib/addressReveal';
import { getBankCode } from '@/lib/banks';
import {
  sendCancellationClaimNotice, sendAutoRefundNotice, sendChangeClaimNotice, sendChangeNotice,
  sendClaimCodeEmail, sendClaimReceivedEmail, sendClaimListEmail, sendClaimListSentEmail,
  sendRefundReportedPaidEmail, sendNoShowOutcomeEmail, sendOrganiserCaseOpenedEmail, sendRefundsOverdueEmail,
  type ClaimRow,
} from '@/lib/server/refundEmails';

// Refund cases and the claim list (Refund Policy v3 §2, §6–§9; Organiser
// Terms §6.4, §10). The organiser pays refunds. Ventry:
//   • on a cancellation, refunds the base price itself only on tickets whose
//     money it still holds (not yet in a settlement), automatically;
//   • for everything else, runs a claim window, emails buyers, collects bank
//     details, and sends the organiser one claim list to pay from;
//   • never pays a refund out of its own money.

type DB = ReturnType<typeof getServerSupabase>;
export type CaseKind = 'cancellation' | 'postponement' | 'venue_change' | 'no_show' | 'time_change';

const DAY = 24 * 60 * 60 * 1000;
export const CLAIM_WINDOW_DAYS = 30;
/** An event counts as over this long after it starts (matches the complete-events cron). */
export const EVENT_END_GRACE_HOURS = 6;
/** Headliner/guest no-show claims: within 24 hours after the event ends (Refund Policy §9.4). */
export const NO_SHOW_CLAIM_HOURS = 24;
const SEND_SPACING_MS = 550;
const OTP_TTL_MS = 15 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ventrybooking.com';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const KIND_LABEL: Record<CaseKind, string> = {
  cancellation: 'Cancelled event',
  postponement: 'Postponement',
  venue_change: 'Venue change',
  no_show: 'Billed act did not appear',
  time_change: 'New start time',
};

/** Lagos calendar date (YYYY-MM-DD) of an instant. */
function lagosDay(d: Date): string {
  return new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}
/** 23:59:59 Lagos on the 30th day after the first notice — the last moment to claim. */
export function claimsCloseFor(openedAt: Date): Date {
  return new Date(`${lagosDay(new Date(openedAt.getTime() + CLAIM_WINDOW_DAYS * DAY))}T23:59:59+01:00`);
}
/** Which of the four notices (1 = day 0, 2 = day 15, 3 = day 25, 4 = day 30) is due by now. */
export function noticeLevelDue(openedAt: Date, closesAt: Date, now = new Date()): number {
  if (now.getTime() >= new Date(`${lagosDay(closesAt)}T00:00:00+01:00`).getTime()) return 4;
  if (now.getTime() >= openedAt.getTime() + 25 * DAY) return 3;
  if (now.getTime() >= openedAt.getTime() + 15 * DAY) return 2;
  return 1;
}
export function noShowClaimsClose(date: string, time: string | null): Date {
  return new Date(eventStart(date, time).getTime() + (EVENT_END_GRACE_HOURS + NO_SHOW_CLAIM_HOURS) * 60 * 60 * 1000);
}

const basePrice = (t: { subtotal: number | null; total_paid: number }) =>
  Number(t.subtotal ?? basePriceFromTotalPaid(Number(t.total_paid)));

// 36^8 combinations; the unique constraint backs it up.
const newRefundId = () => generateClaimRefundId();

async function loadOrganiser(db: DB, id: string) {
  const { data } = await db.from('users').select('id, name, email').eq('id', id).maybeSingle();
  return data as { id: string; name: string | null; email: string } | null;
}

// ── Cancellation ────────────────────────────────────────────────────────────

export interface CancelOutcome {
  caseId: string;
  heldRefunded: number; heldRefundedAmount: number;
  heldFailed: number;
  claimable: number; claimableAmount: number;
  free: number;
  warnings: string[];
}

/** Ticket numbers for the admin's confirm dialog (no side effects). */
export async function previewCancellation(db: DB, eventId: string) {
  const tickets = await activeTickets(db, eventId);
  const out = { held: 0, heldAmount: 0, settled: 0, settledAmount: 0, free: 0 };
  for (const t of tickets) {
    const amt = basePrice(t);
    if (amt <= 0) out.free++;
    else if (!t.settlement_id) { out.held++; out.heldAmount += amt; }
    else { out.settled++; out.settledAmount += amt; }
  }
  return out;
}

async function activeTickets(db: DB, eventId: string) {
  const rows: { id: string; buyer_email: string; buyer_name: string | null; status: string; subtotal: number | null; total_paid: number; paystack_reference: string | null; settlement_id: string | null; purchased_at: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('tickets')
      .select('id, buyer_email, buyer_name, status, subtotal, total_paid, paystack_reference, settlement_id, purchased_at')
      .eq('event_id', eventId).in('status', ['valid', 'used'])
      .order('purchased_at').order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/**
 * Cancels an event (admin action). Held money is refunded by Ventry right
 * away; every other paid ticket becomes a claim the organiser will pay.
 * Notices go out from runRefundJobs (started here, finished by the cron).
 */
export async function cancelEvent(db: DB, eventId: string, opts: { adminId: string; adminEmail: string; reason?: string | null }): Promise<CancelOutcome> {
  const { data: event } = await db.from('events')
    .select('id, event_name, status, organizer_id, refund_policy').eq('id', eventId).maybeSingle();
  if (!event) throw new Error('Event not found');
  if (event.status !== 'approved') throw new Error('Only live (approved) events can be cancelled');

  const { data: flipped, error: flipErr } = await db.from('events')
    .update({ status: 'cancelled' }).eq('id', eventId).eq('status', 'approved').select('id');
  if (flipErr) throw new Error(flipErr.message);
  if (!flipped?.length) throw new Error('The event is already being cancelled');

  import('@/lib/server/affiliateCommission')
    .then(m => m.voidAffiliateCommissionsForEvent(db, eventId))
    .catch(err => console.error('cancel: void affiliate commissions failed', err));

  const tickets = await activeTickets(db, eventId);
  const warnings: string[] = [];

  // Tickets in a settlement that hasn't completed: the money is technically
  // still with Ventry, but the settlement will send it. Flag for admin.
  const pendingSettlementIds = [...new Set(tickets.map(t => t.settlement_id).filter(Boolean))] as string[];
  if (pendingSettlementIds.length) {
    const { data: sets } = await db.from('settlements').select('id, status').in('id', pendingSettlementIds);
    const notDone = (sets ?? []).filter(s => s.status !== 'successful');
    if (notDone.length) warnings.push(`${notDone.length} settlement(s) holding tickets for this event haven't completed (${notDone.map(s => s.status).join(', ')}). Don't retry them before checking: those buyers are on the organiser's claim list.`);
  }

  const now = new Date();
  const closesAt = claimsCloseFor(now);
  const cancelDays = readRefundPolicy(event.refund_policy)?.cancelDays ?? 30;
  const { data: c, error: caseErr } = await db.from('refund_cases').insert({
    event_id: eventId, organizer_id: event.organizer_id, kind: 'cancellation', status: 'open',
    reason: opts.reason ?? null, opened_at: now.toISOString(), claims_close_at: closesAt.toISOString(),
    cancel_days: cancelDays, created_by: opts.adminId,
  }).select('id').single();
  if (caseErr) {
    await db.from('events').update({ status: 'approved' }).eq('id', eventId).eq('status', 'cancelled');
    throw new Error(caseErr.message);
  }

  // One claim row per ticket, recorded before any money moves.
  const claimRows = [];
  for (const t of tickets) {
    const amount = basePrice(t);
    const held = !t.settlement_id;
    claimRows.push({
      case_id: c.id, ticket_id: t.id, refund_code: newRefundId(),
      buyer_email: t.buyer_email.trim().toLowerCase(), buyer_name: t.buyer_name, amount,
      status: amount <= 0 ? 'auto_refunded' : held ? 'auto_refund_failed' : 'unclaimed',
      auto_refund_error: amount > 0 && held ? 'Not attempted yet' : null,
    });
  }
  for (let i = 0; i < claimRows.length; i += 500) {
    const { error } = await db.from('refund_claims').insert(claimRows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
  // Nothing on this event admits anyone any more. 'cancelled', not
  // 'refunded': settled money is refunded by the organiser, and 'refunded'
  // would make the next settlement claw it back from them as well.
  for (let i = 0; i < tickets.length; i += 500) {
    await db.from('tickets').update({ status: 'cancelled' }).in('id', tickets.slice(i, i + 500).map(t => t.id));
  }

  const out: CancelOutcome = { caseId: c.id, heldRefunded: 0, heldRefundedAmount: 0, heldFailed: 0, claimable: 0, claimableAmount: 0, free: 0, warnings };
  for (const t of tickets) {
    const amt = basePrice(t);
    if (amt <= 0) out.free++;
    else if (t.settlement_id) { out.claimable++; out.claimableAmount += amt; }
  }

  // Refund the held money: one Paystack call per payment reference.
  const held = tickets.filter(t => !t.settlement_id && basePrice(t) > 0);
  const byRef = new Map<string, typeof held>();
  for (const t of held) {
    const key = t.paystack_reference ?? `none:${t.id}`;
    byRef.set(key, [...(byRef.get(key) ?? []), t]);
  }
  for (const [ref, group] of byRef) {
    const r = await refundHeldGroup(db, c.id, ref.startsWith('none:') ? null : ref, group, opts.adminEmail);
    if (r.ok) { out.heldRefunded += group.length; out.heldRefundedAmount += r.amount; }
    else out.heldFailed += group.length;
  }

  const organiser = await loadOrganiser(db, event.organizer_id);
  if (organiser?.email) {
    sendOrganiserCaseOpenedEmail({
      to: organiser.email, organiserName: organiser.name ?? 'there', eventName: event.event_name, kind: 'cancellation',
      closesAt: closesAt.toISOString(), cancelDays, heldRefunded: out.heldRefundedAmount, dashboardUrl: `${APP_URL}/organizer/refunds`,
    }).catch(err => console.error('cancel: organiser email failed', err));
  }
  notify({ type: 'organizer', id: event.organizer_id }, {
    notifType: 'event', title: `Event cancelled: ${event.event_name}`,
    body: `Buyers can claim refunds until ${closesAt.toDateString()}. You'll get one claim list then, to pay within ${cancelDays} days.`,
    link: '/organizer/refunds',
  }).catch(console.error);
  notify({ type: 'admin' }, {
    notifType: 'event', title: `Event cancelled: ${event.event_name}`,
    body: `Ventry refunded ${out.heldRefunded} held ticket(s)${out.heldFailed ? `, ${out.heldFailed} failed (retry on Refunds)` : ''}. ${out.claimable} ticket(s) can be claimed from the organiser.`,
    link: '/admin/refunds',
  }, { emailChannel: 'immediate' }).catch(console.error);

  return out;
}

/** Refunds one payment reference's held tickets (base price only). */
async function refundHeldGroup(
  db: DB, caseId: string, reference: string | null,
  group: { id: string; subtotal: number | null; total_paid: number }[], by: string,
): Promise<{ ok: boolean; amount: number }> {
  const amount = group.reduce((s, t) => s + basePrice(t), 0);
  const ids = group.map(t => t.id);
  if (!reference) {
    await db.from('refund_claims').update({ status: 'auto_refund_failed', auto_refund_error: 'No Paystack reference on file: refund by hand' })
      .eq('case_id', caseId).in('ticket_id', ids);
    return { ok: false, amount };
  }
  try {
    await refundTransaction({ transaction: reference, amount: Math.round(amount * 100) });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Paystack refund failed';
    await db.from('refund_claims').update({ status: 'auto_refund_failed', auto_refund_error: reason }).eq('case_id', caseId).in('ticket_id', ids);
    return { ok: false, amount };
  }
  const nowIso = new Date().toISOString();
  // settlement_id is NULL on these, so 'refunded' claws nothing back from anyone.
  await db.from('tickets').update({ status: 'refunded', refunded_at: nowIso, refunded_by: by, refund_reason: 'Event cancelled: held funds refunded by Ventry' }).in('id', ids);
  await db.from('refund_claims').update({ status: 'auto_refunded', auto_refund_error: null, ventry_refunded_at: nowIso }).eq('case_id', caseId).in('ticket_id', ids);
  return { ok: true, amount };
}

/** Admin retry of a failed held-funds refund (all tickets on the same payment). */
export async function retryHeldRefund(db: DB, claimId: string, by: string) {
  const { data: claim } = await db.from('refund_claims').select('id, case_id, ticket_id, status').eq('id', claimId).maybeSingle();
  if (!claim || claim.status !== 'auto_refund_failed') throw new Error('Nothing to retry on this claim');
  const { data: t } = await db.from('tickets').select('paystack_reference').eq('id', claim.ticket_id).maybeSingle();
  const { data: failed } = await db.from('refund_claims').select('ticket_id').eq('case_id', claim.case_id).eq('status', 'auto_refund_failed');
  const { data: group } = await db.from('tickets').select('id, subtotal, total_paid, paystack_reference')
    .in('id', (failed ?? []).map(f => f.ticket_id));
  const same = (group ?? []).filter(g => g.paystack_reference === t?.paystack_reference && (t?.paystack_reference || g.id === claim.ticket_id));
  return refundHeldGroup(db, claim.case_id, t?.paystack_reference ?? null, same, by);
}

/** Admin: the held refund was done by hand (e.g. from the Paystack dashboard). */
export async function markHeldRefundDone(db: DB, claimId: string, by: string) {
  const { data: claim } = await db.from('refund_claims').select('id, ticket_id, status').eq('id', claimId).maybeSingle();
  if (!claim || claim.status !== 'auto_refund_failed') throw new Error('This claim is not waiting on a Ventry refund');
  const nowIso = new Date().toISOString();
  await db.from('tickets').update({ status: 'refunded', refunded_at: nowIso, refunded_by: by, refund_reason: 'Event cancelled: held funds refunded by hand' }).eq('id', claim.ticket_id);
  await db.from('refund_claims').update({ status: 'auto_refunded', auto_refund_error: null, ventry_refunded_at: nowIso }).eq('id', claimId);
}

// ── Postponement / venue change ─────────────────────────────────────────────

/**
 * After a postponement, venue change or same-day time change on an event
 * with sales. Every holder from before the change is told. If the
 * organiser's published policy offers a refund for it, a claim window opens
 * too (notices from runRefundJobs). Time changes never carry a refund
 * (Refund Policy §8.5).
 */
export async function handleEventChange(db: DB, params: {
  eventId: string; kind: 'postponement' | 'venue_change' | 'time_change'; changeLines: string[]; changedAt: Date;
}) {
  const { data: event } = await db.from('events')
    .select('id, slug, event_name, organizer_id, refund_policy').eq('id', params.eventId).maybeSingle();
  if (!event) return;
  const policy = readRefundPolicy(event.refund_policy);
  const refundable = params.kind === 'postponement'
    ? policy?.postponement === 'refund_all' || policy?.postponement === 'refund_on_request'
    : params.kind === 'venue_change' ? policy?.venueChange === 'refund_on_request' : false;

  const closesAt = claimsCloseFor(params.changedAt);
  const { data: c, error } = await db.from('refund_cases').insert({
    event_id: params.eventId, organizer_id: event.organizer_id, kind: params.kind, status: 'open', refundable,
    reason: params.changeLines.join(' · '), opened_at: params.changedAt.toISOString(),
    claims_close_at: (refundable ? closesAt : params.changedAt).toISOString(),
    cancel_days: policy?.cancelDays ?? 30,
  }).select('id').single();
  if (error) throw new Error(error.message);

  if (refundable) {
    const tickets = (await activeTickets(db, params.eventId))
      .filter(t => t.status === 'valid' && new Date(t.purchased_at) < params.changedAt);
    const rows = [];
    for (const t of tickets) {
      const amount = basePrice(t);
      if (amount <= 0) continue;
      rows.push({ case_id: c.id, ticket_id: t.id, refund_code: newRefundId(), buyer_email: t.buyer_email.trim().toLowerCase(), buyer_name: t.buyer_name, amount });
    }
    for (let i = 0; i < rows.length; i += 500) await db.from('refund_claims').insert(rows.slice(i, i + 500));

    const organiser = await loadOrganiser(db, event.organizer_id);
    if (organiser?.email) {
      sendOrganiserCaseOpenedEmail({
        to: organiser.email, organiserName: organiser.name ?? 'there', eventName: event.event_name, kind: params.kind as 'postponement' | 'venue_change',
        closesAt: closesAt.toISOString(), cancelDays: policy?.cancelDays ?? 30, dashboardUrl: `${APP_URL}/organizer/refunds`,
      }).catch(console.error);
    }
  }
  await runRefundJobs(25_000, c.id);
}

/** Notice-only case (no refund): email every holder from before the change once, then close. */
async function runNoticeOnlyCase(db: DB, c: { id: string; event_id: string; kind: string; opened_at: string; reason: string | null }, ev: { event_name: string; slug: string | null }, pace: () => Promise<void>, outOfTime: () => boolean) {
  const tickets = (await activeTickets(db, c.event_id)).filter(t => t.status === 'valid' && new Date(t.purchased_at) < new Date(c.opened_at));
  const holders = new Map<string, string>();
  for (const t of tickets) holders.set(t.buyer_email.trim().toLowerCase(), t.buyer_name ?? '');
  const purposeOf = (to: string) => `event_change:${c.id}:${to}`;
  const emails = [...holders.keys()];
  const sentBefore = new Set<string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await db.from('email_deliveries').select('purpose').in('purpose', emails.slice(i, i + 200).map(purposeOf));
    for (const r of data ?? []) sentBefore.add(r.purpose);
  }
  let sent = 0;
  let finished = true;
  for (const to of emails) {
    if (sentBefore.has(purposeOf(to))) continue;
    if (outOfTime()) { finished = false; break; }
    await pace();
    try {
      await sendChangeNotice({ to, buyerName: holders.get(to) ?? '', eventName: ev.event_name, kind: c.kind as 'postponement' | 'venue_change' | 'time_change', changeLines: (c.reason ?? '').split(' · ').filter(Boolean), eventUrl: `${APP_URL}/${ev.slug ?? ''}`, purpose: purposeOf(to) });
      sent++;
    } catch (err) {
      console.error('change notice failed', c.id, to, err);
      finished = false;
    }
  }
  if (finished) await db.from('refund_cases').update({ status: 'closed' }).eq('id', c.id).eq('status', 'open');
  return sent;
}

// ── Buyer claims ────────────────────────────────────────────────────────────

const hashOtp = (code: string, claimId: string) => createHash('sha256').update(`claim:${code}:${claimId}`).digest('hex');
const maskEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => a + '*'.repeat(Math.max(1, b.length)) + c);

async function issueClaimCode(db: DB, claimId: string, email: string, eventName: string) {
  const code = randomInt(100000, 999999).toString();
  await db.from('refund_claims').update({ otp_hash: hashOtp(code, claimId), otp_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(), otp_attempts: 0 }).eq('id', claimId);
  await sendClaimCodeEmail(email, eventName, code);
}

export type ClaimStart =
  | { ok: true; claimId: string; sentTo: string; eventName: string; amount: number; kind: CaseKind; closesAt: string; acts?: { name: string; liability: string }[] }
  | { ok: false; error: string };

/** Step 1 (cancellation / postponement / venue change): ticket ID + refund ID → code to the purchase email. */
export async function startClaim(db: DB, ticketId: string, refundCode: string): Promise<ClaimStart> {
  const { data: claim } = await db.from('refund_claims')
    .select('id, case_id, ticket_id, buyer_email, amount, status, refund_cases!inner(kind, status, claims_close_at, events!inner(event_name))')
    .eq('refund_code', refundCode.trim().toUpperCase()).maybeSingle();
  if (!claim || claim.ticket_id !== ticketId.trim().toUpperCase()) return { ok: false, error: 'That ticket ID and refund ID don’t match. Copy both from your email.' };
  const rc = (Array.isArray(claim.refund_cases) ? claim.refund_cases[0] : claim.refund_cases) as unknown as { kind: CaseKind; status: string; claims_close_at: string; events: { event_name: string } | { event_name: string }[] };
  const eventName = (Array.isArray(rc.events) ? rc.events[0] : rc.events).event_name;
  if (claim.status === 'claimed' || claim.status === 'paid') return { ok: false, error: 'This ticket has already been claimed. Check your email for the confirmation.' };
  if (claim.status === 'auto_refunded' || claim.status === 'auto_refund_failed') return { ok: false, error: 'Ventry is refunding this ticket directly, so there’s nothing to claim.' };
  if (rc.status !== 'open' || new Date() > new Date(rc.claims_close_at)) return { ok: false, error: 'The claim window for this event has closed. Claims made after it closes are not paid.' };
  const { data: t } = await db.from('tickets').select('status').eq('id', claim.ticket_id).maybeSingle();
  if (rc.kind !== 'cancellation' && t?.status !== 'valid') return { ok: false, error: 'This ticket can no longer be refunded (it has been used or already refunded).' };
  await issueClaimCode(db, claim.id, claim.buyer_email, eventName);
  return { ok: true, claimId: claim.id, sentTo: maskEmail(claim.buyer_email), eventName, amount: Number(claim.amount), kind: rc.kind, closesAt: rc.claims_close_at };
}

/** Acts whose no-show can be claimed for: the Headliner always; guests only if the organiser offered it. */
function claimableActs(lineup: unknown, guestRefund: boolean) {
  const acts = Array.isArray(lineup) ? lineup as { name?: string; liability?: string }[] : [];
  return acts.filter(a => a.name && (a.liability === 'headliner' || (a.liability === 'guest' && guestRefund)))
    .map(a => ({ name: String(a.name), liability: String(a.liability) }));
}

/** Step 1 for a no-show claim: ticket ID + purchase email (there is no refund ID yet). */
export async function startNoShowClaim(db: DB, ticketId: string, email: string): Promise<ClaimStart> {
  const { data: t } = await db.from('tickets')
    .select('id, event_id, buyer_email, buyer_name, status, subtotal, total_paid, organizer_id')
    .eq('id', ticketId.trim().toUpperCase()).maybeSingle();
  if (!t || t.buyer_email.trim().toLowerCase() !== email.trim().toLowerCase()) return { ok: false, error: 'We couldn’t find that ticket for that email address. Use the email you bought with.' };
  if (t.status !== 'valid' && t.status !== 'used') return { ok: false, error: 'This ticket has already been refunded or cancelled.' };
  const { data: ev } = await db.from('events').select('id, event_name, date, time, lineup, refund_policy, organizer_id').eq('id', t.event_id).maybeSingle();
  if (!ev) return { ok: false, error: 'Event not found.' };
  const acts = claimableActs(ev.lineup, readRefundPolicy(ev.refund_policy)?.guestNoShow === 'refund_on_request');
  if (!acts.length) return { ok: false, error: 'This event has no billed act whose absence can be claimed for. See the refund policy on the event page.' };
  const start = eventStart(String(ev.date), ev.time);
  const closes = noShowClaimsClose(String(ev.date), ev.time);
  if (Date.now() < start.getTime()) return { ok: false, error: 'Claims for an act not appearing open once the event has started.' };
  if (Date.now() > closes.getTime()) return { ok: false, error: 'Claims for an act not appearing had to be made within 24 hours after the event ended.' };
  const amount = basePrice(t);
  if (amount <= 0) return { ok: false, error: 'This ticket was free, so there is nothing to refund.' };

  // One no-show case per event, created by the first claim.
  let { data: c } = await db.from('refund_cases').select('id, status').eq('event_id', ev.id).eq('kind', 'no_show').maybeSingle();
  if (!c) {
    const ins = await db.from('refund_cases').insert({
      event_id: ev.id, organizer_id: ev.organizer_id, kind: 'no_show', status: 'verifying',
      claims_close_at: closes.toISOString(), cancel_days: readRefundPolicy(ev.refund_policy)?.cancelDays ?? 30,
    }).select('id, status').single();
    if (ins.error) {
      const again = await db.from('refund_cases').select('id, status').eq('event_id', ev.id).eq('kind', 'no_show').maybeSingle();
      c = again.data;
    } else {
      c = ins.data;
      await openNoShowCase(db, ev.id, ev.organizer_id, ev.event_name, closes);
    }
  }
  if (!c || c.status !== 'verifying') return { ok: false, error: 'Claims for this event have closed.' };

  let { data: claim } = await db.from('refund_claims').select('id, status').eq('case_id', c.id).eq('ticket_id', t.id).maybeSingle();
  if (claim && claim.status !== 'unclaimed') return { ok: false, error: 'You’ve already claimed for this ticket.' };
  if (!claim) {
    const ins = await db.from('refund_claims').insert({
      case_id: c.id, ticket_id: t.id, refund_code: newRefundId(), buyer_email: t.buyer_email.trim().toLowerCase(),
      buyer_name: t.buyer_name, amount, notices_sent: 4,
    }).select('id, status').single();
    claim = ins.data;
  }
  if (!claim) return { ok: false, error: 'Something went wrong. Please try again.' };
  await issueClaimCode(db, claim.id, t.buyer_email, ev.event_name);
  return { ok: true, claimId: claim.id, sentTo: maskEmail(t.buyer_email), eventName: ev.event_name, amount, kind: 'no_show', closesAt: closes.toISOString(), acts };
}

/** First no-show claim: hold the organiser's unsettled money while Ventry verifies (Refund Policy §9.4). */
async function openNoShowCase(db: DB, eventId: string, organizerId: string, eventName: string, closes: Date) {
  const { data: org } = await db.from('users').select('settlement_hold').eq('id', organizerId).maybeSingle();
  if (org && !org.settlement_hold) {
    await db.from('users').update({ settlement_hold: true, settlement_hold_reason: `no_show:${eventId}` }).eq('id', organizerId);
  }
  notify({ type: 'admin' }, {
    notifType: 'event', title: `No-show refund claims: ${eventName}`,
    body: `Buyers say a billed act didn't appear. Claims close ${closes.toUTCString()}. Verify with the organiser and venue, then uphold or reject. The organiser's settlements are held meanwhile.`,
    link: '/admin/refunds',
  }, { emailChannel: 'immediate' }).catch(console.error);
  const organiser = await loadOrganiser(db, organizerId);
  if (organiser?.email) {
    sendOrganiserCaseOpenedEmail({ to: organiser.email, organiserName: organiser.name ?? 'there', eventName, kind: 'no_show', closesAt: closes.toISOString(), cancelDays: 0, dashboardUrl: `${APP_URL}/organizer/refunds` })
      .catch(console.error);
  }
}

/** Step 2: code + bank account → the claim is recorded. */
export async function submitClaim(db: DB, params: { claimId: string; code: string; bankName: string; accountNumber: string; statement?: string | null }): Promise<{ ok: true; accountName: string } | { ok: false; error: string }> {
  const { data: claim } = await db.from('refund_claims')
    .select('id, case_id, ticket_id, buyer_email, buyer_name, amount, status, refund_code, otp_hash, otp_expires_at, otp_attempts, refund_cases!inner(kind, status, claims_close_at, events!inner(event_name))')
    .eq('id', params.claimId).maybeSingle();
  if (!claim) return { ok: false, error: 'Start your claim again.' };
  const rc = (Array.isArray(claim.refund_cases) ? claim.refund_cases[0] : claim.refund_cases) as unknown as { kind: CaseKind; status: string; claims_close_at: string; events: { event_name: string } | { event_name: string }[] };
  const eventName = (Array.isArray(rc.events) ? rc.events[0] : rc.events).event_name;
  if (claim.status !== 'unclaimed') return { ok: false, error: 'This ticket has already been claimed.' };
  if (!['open', 'verifying'].includes(rc.status) || new Date() > new Date(rc.claims_close_at)) return { ok: false, error: 'The claim window has closed.' };
  if ((claim.otp_attempts ?? 0) >= OTP_MAX_ATTEMPTS) return { ok: false, error: 'Too many wrong codes. Start again to get a new one.' };
  if (!claim.otp_hash || !claim.otp_expires_at || new Date(claim.otp_expires_at) < new Date() || hashOtp(params.code.trim(), claim.id) !== claim.otp_hash) {
    await db.from('refund_claims').update({ otp_attempts: (claim.otp_attempts ?? 0) + 1 }).eq('id', claim.id);
    return { ok: false, error: 'That code is wrong or has expired.' };
  }
  const bankCode = getBankCode(params.bankName);
  const accountNumber = params.accountNumber.replace(/\D/g, '');
  if (!bankCode) return { ok: false, error: 'Choose your bank from the list.' };
  if (!/^\d{10}$/.test(accountNumber)) return { ok: false, error: 'Enter your 10-digit account number.' };
  let accountName: string;
  try {
    accountName = await resolveAccountName({ accountNumber, bankCode });
  } catch {
    return { ok: false, error: 'We couldn’t confirm that account. Check the bank and account number.' };
  }

  const { data: updated } = await db.from('refund_claims').update({
    status: 'claimed', claimed_at: new Date().toISOString(), bank_name: params.bankName, bank_code: bankCode,
    account_number: accountNumber, account_name: accountName, statement: params.statement?.slice(0, 1000) || null,
    otp_hash: null, otp_expires_at: null,
  }).eq('id', claim.id).eq('status', 'unclaimed').select('id');
  if (!updated?.length) return { ok: false, error: 'This ticket has already been claimed.' };

  // Claiming instead of keeping the ticket on a postponement/venue change gives the ticket up.
  if (rc.kind === 'postponement' || rc.kind === 'venue_change') {
    await db.from('tickets').update({ status: 'cancelled' }).eq('id', claim.ticket_id).eq('status', 'valid');
  }

  sendClaimReceivedEmail({
    to: claim.buyer_email, buyerName: claim.buyer_name ?? '', eventName, ticketId: claim.ticket_id, refundCode: claim.refund_code,
    amount: Number(claim.amount), accountLine: `${accountName}, ${params.bankName} ****${accountNumber.slice(-4)}`,
    listBy: rc.kind === 'no_show' ? null : rc.claims_close_at, noShow: rc.kind === 'no_show', purpose: `refund_claim_received:${claim.id}`,
  }).catch(err => console.error('claim received email failed', err));
  return { ok: true, accountName };
}

// ── Scheduled work: notices, claim lists, overdue ────────────────────────────

/**
 * Hourly (from the admin-digest cron) and right after a case opens:
 *  1. sends the day 0/15/25/30 notices that are due (one email per buyer);
 *  2. closes windows that have ended and sends the organiser the claim list;
 *  3. flags claim lists the organiser hasn't reported paid by the deadline.
 * Resumable: per-claim notice counters mean nobody is emailed twice.
 */
export async function runRefundJobs(budgetMs = 30_000, onlyCaseId?: string) {
  const started = Date.now();
  const db = getServerSupabase();
  const stats = { notices: 0, listsSent: 0, overdue: 0 };
  const outOfTime = () => Date.now() - started > budgetMs;

  let q = db.from('refund_cases')
    .select('id, event_id, organizer_id, kind, status, refundable, opened_at, claims_close_at, cancel_days, list_sent_at, pay_by, paid_reported_at, overdue_flagged_at, reason, events!inner(event_name, slug, refund_policy, date, time, venue, city)')
    .in('status', ['open', 'list_sent']);
  if (onlyCaseId) q = q.eq('id', onlyCaseId);
  const { data: cases, error } = await q;
  if (error) throw new Error(error.message);

  let last = 0;
  const pace = async () => { const w = SEND_SPACING_MS - (Date.now() - last); if (w > 0) await sleep(w); last = Date.now(); };

  for (const c of cases ?? []) {
    if (outOfTime()) break;
    const ev = (Array.isArray(c.events) ? c.events[0] : c.events) as unknown as { event_name: string; slug: string | null; refund_policy: unknown; date: string; time: string; venue: string; city: string };
    const policy = readRefundPolicy(ev.refund_policy);
    const organiser = await loadOrganiser(db, c.organizer_id);
    const now = new Date();

    if (c.status === 'open' && !c.refundable) {
      stats.notices += await runNoticeOnlyCase(db, c, ev, pace, outOfTime);
    } else if (c.status === 'open') {
      const level = noticeLevelDue(new Date(c.opened_at), new Date(c.claims_close_at), now);
      const windowOver = now > new Date(c.claims_close_at);
      if (!windowOver) {
        const { data: due } = await db.from('refund_claims')
          .select('id, ticket_id, refund_code, buyer_email, buyer_name, amount, status, notices_sent')
          .eq('case_id', c.id).lt('notices_sent', level);
        const groups = new Map<string, NonNullable<typeof due>>();
        for (const r of due ?? []) {
          // Reminders go only to people who haven't claimed; the first notice goes to everyone.
          if (level > 1 && r.status !== 'unclaimed') { await db.from('refund_claims').update({ notices_sent: level }).eq('id', r.id); continue; }
          const key = `${r.status === 'unclaimed' ? 'claim' : 'auto'}|${r.buyer_email}`;
          groups.set(key, [...(groups.get(key) ?? []), r]);
        }
        for (const [key, rows] of groups) {
          if (outOfTime()) break;
          await pace();
          const [type, to] = key.split('|');
          const purpose = `refund_notice:${c.id}:${level}:${to}`;
          try {
            if (type === 'auto') {
              for (const r of rows) {
                await sendAutoRefundNotice({ to, buyerName: r.buyer_name ?? '', eventName: ev.event_name, amount: Number(r.amount), failed: r.status === 'auto_refund_failed', purpose: `${purpose}:${r.ticket_id}` });
              }
            } else {
              const claimRows: ClaimRow[] = rows.map(r => ({ ticketId: r.ticket_id, refundCode: r.refund_code, amount: Number(r.amount) }));
              if (c.kind === 'cancellation') {
                await sendCancellationClaimNotice({ to, buyerName: rows[0].buyer_name ?? '', eventName: ev.event_name, rows: claimRows, closesAt: c.claims_close_at, noticeNo: level, cancelDays: c.cancel_days, organiserName: organiser?.name ?? 'the organiser', organiserEmail: policy?.contactEmail, purpose });
              } else {
                await sendChangeClaimNotice({ to, buyerName: rows[0].buyer_name ?? '', eventName: ev.event_name, kind: c.kind as 'postponement' | 'venue_change', changeLines: (c.reason ?? '').split(' · ').filter(Boolean), refundAll: policy?.postponement === 'refund_all' && c.kind === 'postponement', rows: claimRows, closesAt: c.claims_close_at, noticeNo: level, cancelDays: c.cancel_days, organiserName: organiser?.name ?? 'the organiser', organiserEmail: policy?.contactEmail, eventUrl: `${APP_URL}/${ev.slug ?? ''}`, purpose });
              }
            }
            await db.from('refund_claims').update({ notices_sent: level }).in('id', rows.map(r => r.id));
            stats.notices++;
          } catch (err) {
            console.error('refund notice failed', c.id, to, err);
          }
        }
      } else {
        await sendClaimList(db, c.id);
        stats.listsSent++;
      }
    } else if (c.status === 'list_sent' && c.pay_by && !c.paid_reported_at && !c.overdue_flagged_at && now > new Date(c.pay_by)) {
      await db.from('refund_cases').update({ overdue_flagged_at: now.toISOString() }).eq('id', c.id);
      notify({ type: 'admin' }, {
        notifType: 'payout', title: `Refunds overdue: ${ev.event_name}`,
        body: `${organiser?.name ?? 'The organiser'} hasn't reported the claim list paid (deadline ${new Date(c.pay_by).toDateString()}). Consider holding their settlements.`,
        link: '/admin/refunds',
      }, { emailChannel: 'immediate' }).catch(console.error);
      if (organiser?.email) await sendRefundsOverdueEmail({ to: organiser.email, organiserName: organiser.name ?? 'there', eventName: ev.event_name, payBy: c.pay_by, dashboardUrl: `${APP_URL}/organizer/refunds` }).catch(console.error);
      stats.overdue++;
    }
  }
  return stats;
}

/** Closes a case's window and sends the organiser the one claim list (also used when admin upholds a no-show). */
export async function sendClaimList(db: DB, caseId: string) {
  const { data: c } = await db.from('refund_cases')
    .select('id, kind, status, organizer_id, cancel_days, events!inner(event_name, refund_policy)').eq('id', caseId).maybeSingle();
  if (!c || !['open', 'verifying'].includes(c.status)) return;
  const ev = (Array.isArray(c.events) ? c.events[0] : c.events) as unknown as { event_name: string; refund_policy: unknown };
  const { data: claims } = await db.from('refund_claims')
    .select('id, ticket_id, refund_code, buyer_email, buyer_name, amount, status, bank_name, account_number, account_name')
    .eq('case_id', caseId);
  const claimed = (claims ?? []).filter(r => r.status === 'claimed');
  const ventryRefunded = (claims ?? []).filter(r => r.status === 'auto_refunded' && Number(r.amount) > 0);
  const now = new Date();

  if (!claimed.length) {
    await db.from('refund_cases').update({ status: 'closed', list_sent_at: now.toISOString() }).eq('id', caseId).in('status', ['open', 'verifying']);
    return;
  }
  const payBy = new Date(`${lagosDay(new Date(now.getTime() + c.cancel_days * DAY))}T23:59:59+01:00`);
  const { data: moved } = await db.from('refund_cases')
    .update({ status: 'list_sent', list_sent_at: now.toISOString(), pay_by: payBy.toISOString() })
    .eq('id', caseId).in('status', ['open', 'verifying']).select('id');
  if (!moved?.length) return;

  const organiser = await loadOrganiser(db, c.organizer_id);
  const total = claimed.reduce((s, r) => s + Number(r.amount), 0);
  if (organiser?.email) {
    await sendClaimListEmail({
      to: organiser.email, organiserName: organiser.name ?? 'there', eventName: ev.event_name, kindLabel: KIND_LABEL[c.kind as CaseKind],
      claims: claimed.map(r => ({ buyerName: r.buyer_name ?? '', ticketId: r.ticket_id, refundCode: r.refund_code, amount: Number(r.amount), bankName: r.bank_name ?? '', accountNumber: r.account_number ?? '', accountName: r.account_name ?? '' })),
      ventryRefunded: ventryRefunded.map(r => ({ ticketId: r.ticket_id, amount: Number(r.amount) })),
      payBy: payBy.toISOString(), total, dashboardUrl: `${APP_URL}/organizer/refunds`, purpose: `claim_list:${caseId}`,
    }).catch(err => console.error('claim list email failed', err));
  }
  notify({ type: 'organizer', id: c.organizer_id }, {
    notifType: 'payout', title: `Refund claim list: ${ev.event_name}`,
    body: `${claimed.length} claim(s), ${total.toLocaleString('en-NG')} NGN. Pay by ${payBy.toDateString()} and report it with proof.`,
    link: '/organizer/refunds',
  }).catch(console.error);

  const contact = readRefundPolicy(ev.refund_policy)?.contactEmail;
  const seen = new Set<string>();
  for (const r of claimed) {
    if (seen.has(r.buyer_email)) continue;
    seen.add(r.buyer_email);
    await sleep(SEND_SPACING_MS);
    if (c.kind === 'no_show') {
      await sendNoShowOutcomeEmail({ to: r.buyer_email, buyerName: r.buyer_name ?? '', eventName: ev.event_name, upheld: true, payBy: payBy.toISOString(), purpose: `no_show_outcome:${caseId}:${r.buyer_email}` }).catch(console.error);
    } else {
      await sendClaimListSentEmail({ to: r.buyer_email, buyerName: r.buyer_name ?? '', eventName: ev.event_name, payBy: payBy.toISOString(), organiserEmail: contact, purpose: `claim_list_sent:${caseId}:${r.buyer_email}` }).catch(console.error);
    }
  }
}

/** Admin decision on a no-show case, once its claim window has closed. */
export async function decideNoShow(db: DB, caseId: string, params: { upheld: boolean; note?: string | null; adminId: string }) {
  const { data: c } = await db.from('refund_cases').select('id, status, organizer_id, event_id, claims_close_at, events!inner(event_name)').eq('id', caseId).eq('kind', 'no_show').maybeSingle();
  if (!c || c.status !== 'verifying') throw new Error('This case is not awaiting a decision');
  if (new Date() < new Date(c.claims_close_at)) throw new Error('Wait until the claim window closes so every claim is on one list');
  await db.from('refund_cases').update({ decided_by: params.adminId, decided_at: new Date().toISOString(), decision_note: params.note ?? null }).eq('id', caseId);
  if (params.upheld) {
    await sendClaimList(db, caseId);
  } else {
    await db.from('refund_cases').update({ status: 'rejected' }).eq('id', caseId);
    const ev = (Array.isArray(c.events) ? c.events[0] : c.events) as unknown as { event_name: string };
    const { data: claims } = await db.from('refund_claims').select('buyer_email, buyer_name').eq('case_id', caseId).eq('status', 'claimed');
    const seen = new Set<string>();
    for (const r of claims ?? []) {
      if (seen.has(r.buyer_email)) continue;
      seen.add(r.buyer_email);
      await sleep(SEND_SPACING_MS);
      await sendNoShowOutcomeEmail({ to: r.buyer_email, buyerName: r.buyer_name ?? '', eventName: ev.event_name, upheld: false, note: params.note, purpose: `no_show_outcome:${caseId}:${r.buyer_email}` }).catch(console.error);
    }
  }
  // Lift the hold this case placed (never one admin set for another reason).
  await db.from('users').update({ settlement_hold: false, settlement_hold_reason: null })
    .eq('id', c.organizer_id).eq('settlement_hold_reason', `no_show:${c.event_id}`);
}

/** Organiser reports the claim list paid, with proof (Refund Policy §6.7). */
export async function reportListPaid(db: DB, caseId: string, organiserId: string, proofUrl: string, note: string | null) {
  const { data: c } = await db.from('refund_cases').select('id, status, organizer_id, events!inner(event_name)').eq('id', caseId).maybeSingle();
  if (!c || c.organizer_id !== organiserId) throw new Error('Not found');
  if (c.status !== 'list_sent') throw new Error('There is no claim list waiting to be paid on this case');
  const nowIso = new Date().toISOString();
  await db.from('refund_cases').update({ status: 'paid_reported', paid_reported_at: nowIso, payment_proof_url: proofUrl, organizer_note: note }).eq('id', caseId);
  const { data: claims } = await db.from('refund_claims').update({ status: 'paid' }).eq('case_id', caseId).eq('status', 'claimed').select('buyer_email, buyer_name, amount');
  const ev = (Array.isArray(c.events) ? c.events[0] : c.events) as unknown as { event_name: string };
  notify({ type: 'admin' }, {
    notifType: 'payout', title: `Refunds reported paid: ${ev.event_name}`,
    body: `The organiser reported ${claims?.length ?? 0} refund(s) paid and uploaded proof. Buyers have been told.`,
    link: '/admin/refunds',
  }).catch(console.error);
  const byEmail = new Map<string, { name: string; amount: number }>();
  for (const r of claims ?? []) {
    const cur = byEmail.get(r.buyer_email);
    byEmail.set(r.buyer_email, { name: r.buyer_name ?? '', amount: (cur?.amount ?? 0) + Number(r.amount) });
  }
  for (const [to, v] of byEmail) {
    await sleep(SEND_SPACING_MS);
    await sendRefundReportedPaidEmail({ to, buyerName: v.name, eventName: ev.event_name, amount: v.amount, purpose: `refund_reported_paid:${caseId}:${to}` }).catch(console.error);
  }
  return claims?.length ?? 0;
}
