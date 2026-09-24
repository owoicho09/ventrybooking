import { getServerSupabase } from '@/lib/supabase/server';
import { PLATFORM_FEE_RATE } from '@/lib/fees';
import { getBankCode } from '@/lib/banks';
import { generateSettlementRef } from '@/lib/server/ids';
import { createTransferRecipient, initiateTransferChecked, verifyTransfer } from '@/lib/server/paystack';
import { notify } from '@/lib/server/notify';

/*
 * Daily settlements. Sales on Lagos calendar day D become releasable on the
 * next working day (weekends and rows in settlement_holidays roll forward);
 * an admin releases them by hand. See supabase/migrations/038 for the ledger
 * and the atomic claim/retry functions this module drives.
 */

type Db = ReturnType<typeof getServerSupabase>;

export type SettlementStatus = 'processing' | 'otp_pending' | 'successful' | 'failed' | 'void';

export interface SettlementRow {
  id: string;
  organizer_id: string;
  kind: 'daily' | 'legacy_escrow';
  period_start: string;
  period_end: string;
  gross: number;
  refunds_deducted: number;
  fee: number;
  net: number;
  fee_rate: number;
  ticket_count: number;
  status: SettlementStatus;
  failure_reason: string | null;
  transfer_reference: string | null;
  transfer_code: string | null;
  attempts: number;
  released_by: string | null;
  released_at: string;
  settled_at: string | null;
  event_name: string | null;
  updated_at: string;
}

export interface OrganizerRow {
  id: string;
  name: string;
  email: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  platform_fee_rate: number | null;
}

// ── Working-day calendar ────────────────────────────────────────────────────

/** Africa/Lagos is UTC+1 all year (no DST). */
export function lagosDate(at: Date = new Date()): string {
  return new Date(at.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function loadHolidays(db: Db): Promise<Map<string, string>> {
  const { data, error } = await db.from('settlement_holidays').select('holiday_date, name');
  if (error) throw new Error(`Could not load holiday calendar: ${error.message}`);
  return new Map((data ?? []).map(h => [h.holiday_date as string, h.name as string]));
}

export function isWorkingDay(date: string, holidays: Map<string, string>): boolean {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !holidays.has(date);
}

/** First working day strictly after `date`. */
export function nextWorkingDay(date: string, holidays: Map<string, string>): string {
  let d = addDays(date, 1);
  while (!isWorkingDay(d, holidays)) d = addDays(d, 1);
  return d;
}

/**
 * Sales dated strictly before the returned date are releasable today. Sales
 * on D are eligible on nextWorkingDay(D), which is ≤ today exactly when some
 * working day falls in (D, today] — i.e. when D is before the latest working
 * day on or before today.
 */
export function releaseCutoff(today: string, holidays: Map<string, string>): string {
  let d = today;
  while (!isWorkingDay(d, holidays)) d = addDays(d, -1);
  return d;
}

// ── Eligibility ─────────────────────────────────────────────────────────────

export interface EligibilityContext {
  organizer: OrganizerRow;
  /** Net the release would send (97% basis, after refunds owed). */
  releasableNet: number;
}

/**
 * Every condition an organiser must pass before a release. Each returns null
 * when satisfied or a human-readable reason when not. Add future gates here —
 * e.g. an identity-verification check, or a settlement cap — as new entries;
 * nothing else in the release flow needs to change.
 */
export const ELIGIBILITY_CONDITIONS: { id: string; check: (ctx: EligibilityContext) => string | null }[] = [
  {
    id: 'has_releasable_funds',
    check: ({ releasableNet }) => (releasableNet > 0 ? null : 'Nothing releasable yet'),
  },
  {
    id: 'bank_details',
    check: ({ organizer }) => (organizer.account_number ? null : 'No bank account on file'),
  },
  {
    id: 'known_bank',
    check: ({ organizer }) =>
      !organizer.account_number || getBankCode(organizer.bank_name || '')
        ? null
        : `Unknown bank "${organizer.bank_name}" — organiser must update bank details`,
  },
];

export function eligibilityBlockers(ctx: EligibilityContext): string[] {
  return ELIGIBILITY_CONDITIONS.map(c => c.check(ctx)).filter((r): r is string => r !== null);
}

// ── Pending (not-yet-released) figures ─────────────────────────────────────

export function feeRateOf(org: Pick<OrganizerRow, 'platform_fee_rate'>): number {
  return org.platform_fee_rate ?? PLATFORM_FEE_RATE;
}

export function splitFee(gross: number, rate: number) {
  const fee = Math.round(gross * rate);
  return { gross, fee, net: gross - fee };
}

export interface PendingSummary {
  /** Releasable now — sales before the cutoff, less refunds owed back. */
  releasable: {
    salesGross: number; refundsDeducted: number; gross: number; fee: number; net: number;
    ticketCount: number; periodStart: string; periodEnd: string;
  } | null;
  /** Sales not yet eligible, grouped by the working day they become releasable. */
  accruing: { eligibleOn: string; periodStart: string; periodEnd: string; gross: number; fee: number; net: number; ticketCount: number }[];
  refundsOwed: { gross: number; ticketCount: number };
}

type DayRow = { organizer_id: string; sale_date: string; gross: number; ticket_count: number };
type OwedRow = { organizer_id: string; gross: number; ticket_count: number };

export async function loadUnsettled(db: Db, organizerId?: string) {
  const args = organizerId ? { p_organizer_id: organizerId } : {};
  const [days, owed] = await Promise.all([
    db.rpc('settlement_unsettled_by_day', args),
    db.rpc('settlement_refunds_owed', args),
  ]);
  if (days.error) throw new Error(`Unsettled lookup failed: ${days.error.message}`);
  if (owed.error) throw new Error(`Refunds-owed lookup failed: ${owed.error.message}`);
  const byOrg = new Map<string, { days: DayRow[]; owed: OwedRow | null }>();
  for (const r of (days.data ?? []) as DayRow[]) {
    const e = byOrg.get(r.organizer_id) ?? { days: [], owed: null };
    e.days.push({ ...r, gross: Number(r.gross), ticket_count: Number(r.ticket_count) });
    byOrg.set(r.organizer_id, e);
  }
  for (const r of (owed.data ?? []) as OwedRow[]) {
    const e = byOrg.get(r.organizer_id) ?? { days: [], owed: null };
    e.owed = { ...r, gross: Number(r.gross), ticket_count: Number(r.ticket_count) };
    byOrg.set(r.organizer_id, e);
  }
  return byOrg;
}

export function summarizePending(
  days: DayRow[],
  owed: OwedRow | null,
  feeRate: number,
  cutoff: string,
  holidays: Map<string, string>,
): PendingSummary {
  const refundsOwed = { gross: owed?.gross ?? 0, ticketCount: owed?.ticket_count ?? 0 };
  const eligible = days.filter(d => d.sale_date < cutoff).sort((a, b) => a.sale_date.localeCompare(b.sale_date));
  const later    = days.filter(d => d.sale_date >= cutoff);

  let releasable: PendingSummary['releasable'] = null;
  if (eligible.length > 0) {
    const salesGross = eligible.reduce((s, d) => s + d.gross, 0);
    const gross = salesGross - refundsOwed.gross;
    const { fee, net } = splitFee(gross, feeRate);
    releasable = {
      salesGross, refundsDeducted: refundsOwed.gross, gross, fee, net,
      ticketCount: eligible.reduce((s, d) => s + d.ticket_count, 0),
      periodStart: eligible[0].sale_date,
      periodEnd:   eligible[eligible.length - 1].sale_date,
    };
  }

  const groups = new Map<string, DayRow[]>();
  for (const d of later) {
    const on = nextWorkingDay(d.sale_date, holidays);
    groups.set(on, [...(groups.get(on) ?? []), d]);
  }
  const accruing = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([eligibleOn, rows]) => {
      const sorted = rows.sort((a, b) => a.sale_date.localeCompare(b.sale_date));
      const gross = rows.reduce((s, d) => s + d.gross, 0);
      return {
        eligibleOn,
        periodStart: sorted[0].sale_date,
        periodEnd:   sorted[sorted.length - 1].sale_date,
        ...splitFee(gross, feeRate),
        ticketCount: rows.reduce((s, d) => s + d.ticket_count, 0),
      };
    });

  return { releasable, accruing, refundsOwed };
}

/**
 * The organiser's money figures, all on the net (after-fee) basis:
 *   settled — sent and confirmed by Paystack (daily + legacy escrow payouts).
 *   pending — everything not yet settled: unsettled sales (eligible or not)
 *             less refunds owed back, plus settlements in flight or failed.
 */
export async function organizerFundsFigures(db: Db, organizerId: string, feeRate: number) {
  const [unsettled, settlementsRes] = await Promise.all([
    loadUnsettled(db, organizerId),
    db.from('settlements').select('kind, status, net').eq('organizer_id', organizerId),
  ]);
  if (settlementsRes.error) throw new Error(settlementsRes.error.message);
  const rows = (settlementsRes.data ?? []) as { kind: string; status: string; net: number }[];

  const settled = rows.filter(r => r.status === 'successful').reduce((s, r) => s + Number(r.net), 0);
  // A failed legacy payout's tickets were returned to the unsettled pool, so
  // only a failed DAILY settlement still holds its own money.
  const inFlight = rows
    .filter(r => r.status === 'processing' || r.status === 'otp_pending' || (r.status === 'failed' && r.kind === 'daily'))
    .reduce((s, r) => s + Number(r.net), 0);

  const u = unsettled.get(organizerId);
  const unsettledGross = (u?.days ?? []).reduce((s, d) => s + d.gross, 0) - (u?.owed?.gross ?? 0);
  const pending = splitFee(unsettledGross, feeRate).net + inFlight;

  return { settled, pending };
}

// ── Transfer outcomes ───────────────────────────────────────────────────────

type Outcome =
  | { status: 'successful'; transferCode?: string | null; paystackStatus?: string }
  | { status: 'otp_pending' | 'processing'; transferCode?: string | null; paystackStatus?: string; note?: string }
  | { status: 'failed'; reason: string; paystackStatus?: string };

function mapPaystackStatus(status: string, transferCode: string | null, reason?: string | null): Outcome {
  switch (status) {
    case 'success':
      return { status: 'successful', transferCode, paystackStatus: status };
    case 'otp':
      return { status: 'otp_pending', transferCode, paystackStatus: status };
    case 'failed':
    case 'abandoned':
    case 'reversed':
    case 'rejected':
    case 'blocked':
      return { status: 'failed', reason: reason || `Paystack marked the transfer ${status}`, paystackStatus: status };
    default: // pending, received, queued, processing
      return { status: 'processing', transferCode, paystackStatus: status };
  }
}

/**
 * Records a transfer outcome against the attempt with this reference, and
 * against the settlement if that reference is still its current attempt.
 * Only moves forward from an in-flight state, so a webhook that has already
 * landed is never overwritten by a slower API response (and vice versa) —
 * except that a later failure/reversal of a successful transfer is recorded,
 * because the money came back.
 */
export async function applyTransferOutcome(
  db: Db,
  reference: string,
  outcome: Outcome,
  opts: { allowFromSuccessful?: boolean } = {},
): Promise<SettlementRow | null> {
  const now = new Date().toISOString();
  const fromStates = opts.allowFromSuccessful ? ['processing', 'otp_pending', 'successful'] : ['processing', 'otp_pending'];
  const terminal = outcome.status === 'successful' || outcome.status === 'failed';

  await db.from('settlement_attempts')
    .update({
      status:          outcome.status,
      paystack_status: outcome.paystackStatus ?? null,
      failure_reason:  outcome.status === 'failed' ? outcome.reason : ('note' in outcome ? outcome.note ?? null : null),
      ...(outcome.status !== 'failed' && outcome.transferCode ? { transfer_code: outcome.transferCode } : {}),
      ...(terminal ? { finished_at: now } : {}),
    })
    .eq('transfer_reference', reference)
    .in('status', fromStates);

  const { data } = await db.from('settlements')
    .update({
      status:         outcome.status,
      failure_reason: outcome.status === 'failed' ? outcome.reason : ('note' in outcome ? outcome.note ?? null : null),
      ...(outcome.status !== 'failed' && outcome.transferCode ? { transfer_code: outcome.transferCode } : {}),
      ...(outcome.status === 'successful' ? { settled_at: now } : {}),
      ...(outcome.status === 'failed' ? { settled_at: null } : {}),
      updated_at: now,
    })
    .eq('transfer_reference', reference)
    .in('status', fromStates)
    .select('*');

  return ((data ?? [])[0] as SettlementRow | undefined) ?? null;
}

function periodLabel(s: Pick<SettlementRow, 'period_start' | 'period_end'>) {
  return s.period_start === s.period_end ? s.period_start : `${s.period_start} to ${s.period_end}`;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

export function notifySettlementSuccess(s: SettlementRow) {
  notify(
    { type: 'organizer', id: s.organizer_id },
    {
      notifType: 'payout',
      title:     `Settlement sent — ${fmt(s.net)}`,
      body:      `Your ticket sales for ${periodLabel(s)} (${fmt(s.net)} after Ventry's fee) have been sent to your bank account.`,
      link:      '/organizer/payouts',
    },
  ).catch(err => console.error('settlement: notify organizer error', err));
}

/**
 * Sends the settlement's current attempt to Paystack and records what
 * happened. Never marks anything successful that Paystack didn't confirm;
 * an ambiguous API failure is resolved by looking the transfer up before
 * it is allowed to become 'failed' (and therefore retryable).
 */
async function sendTransfer(db: Db, s: SettlementRow, org: OrganizerRow): Promise<SettlementRow> {
  const reference = s.transfer_reference!;
  let outcome: Outcome;

  if (process.env.SETTLEMENT_SIMULATE_FAILURE === 'true') {
    // Test switch: fails BEFORE Paystack is called, so no money can move.
    outcome = { status: 'failed', reason: 'Simulated failure (SETTLEMENT_SIMULATE_FAILURE is on)' };
  } else {
    const bankCode = getBankCode(org.bank_name || '');
    let recipientCode: string | null = null;
    try {
      if (!bankCode || !org.account_number) throw new Error('Bank details are incomplete');
      const recipient = await createTransferRecipient({
        type:           'nuban',
        name:           org.account_name || org.name,
        account_number: org.account_number,
        bank_code:      bankCode,
        currency:       'NGN',
      });
      recipientCode = recipient.recipient_code;
    } catch (err) {
      // No transfer was attempted, so this is a definite failure.
      outcome = { status: 'failed', reason: `Recipient setup failed: ${err instanceof Error ? err.message : 'unknown error'}` };
    }

    if (recipientCode) {
      const res = await initiateTransferChecked({
        amount:    Math.round(Number(s.net) * 100),
        recipient: recipientCode,
        reason:    `Ventry settlement ${periodLabel(s)}`,
        reference,
      });
      if (res.kind === 'ok') {
        outcome = mapPaystackStatus(res.status, res.transferCode);
      } else if (res.kind === 'rejected') {
        outcome = { status: 'failed', reason: `Paystack: ${res.message}` };
      } else {
        try {
          const v = await verifyTransfer(reference);
          outcome = v.found
            ? mapPaystackStatus(v.status, v.transferCode, v.failureReason)
            : { status: 'failed', reason: `Paystack did not create the transfer (${res.message})` };
        } catch (err) {
          outcome = {
            status: 'processing',
            note:   `Outcome unknown (${res.message}; lookup failed: ${err instanceof Error ? err.message : 'error'}) — tap Check status`,
          };
        }
      }
    }
  }

  const updated = await applyTransferOutcome(db, reference, outcome!);
  if (updated?.status === 'successful') notifySettlementSuccess(updated);
  if (outcome!.status === 'failed') {
    notify(
      { type: 'admin' },
      {
        notifType: 'payout',
        title:     `Settlement failed — ${org.name}`,
        body:      `${fmt(Number(s.net))} for ${periodLabel(s)} did not send: ${outcome!.reason}. It can be retried from the payouts page.`,
        link:      `/admin/payouts/${org.id}`,
      },
    ).catch(err => console.error('settlement: notify admin error', err));
  }
  if (updated) return updated;
  // A webhook landed first; return whatever the row says now.
  const { data } = await db.from('settlements').select('*').eq('id', s.id).single();
  return data as SettlementRow;
}

async function loadOrganizer(db: Db, organizerId: string): Promise<OrganizerRow | null> {
  const { data } = await db
    .from('users')
    .select('id, name, email, bank_name, account_number, account_name, platform_fee_rate')
    .eq('id', organizerId)
    .eq('role', 'organizer')
    .maybeSingle();
  return (data as OrganizerRow | null) ?? null;
}

export type ReleaseResult =
  | { organizerId: string; outcome: 'released'; settlement: SettlementRow }
  | { organizerId: string; outcome: 'noop' | 'blocked' | 'error'; message: string };

/**
 * Releases everything currently releasable for one organiser as a single
 * settlement. A second call for the same period finds nothing unclaimed and
 * returns 'noop' — the ticket claim inside claim_settlement is the guard.
 */
export async function releaseForOrganizer(
  db: Db,
  organizerId: string,
  releasedBy: string,
  holidays: Map<string, string>,
): Promise<ReleaseResult> {
  const org = await loadOrganizer(db, organizerId);
  if (!org) return { organizerId, outcome: 'error', message: 'Organiser not found' };

  const feeRate = feeRateOf(org);
  const cutoff  = releaseCutoff(lagosDate(), holidays);
  const pending = (await loadUnsettled(db, organizerId)).get(organizerId);
  const summary = summarizePending(pending?.days ?? [], pending?.owed ?? null, feeRate, cutoff, holidays);

  if (!summary.releasable) {
    return { organizerId, outcome: 'noop', message: 'Nothing to release — already released or not yet eligible' };
  }
  const blockers = eligibilityBlockers({ organizer: org, releasableNet: summary.releasable.net });
  if (blockers.length > 0) return { organizerId, outcome: 'blocked', message: blockers.join('; ') };

  const { data, error } = await db.rpc('claim_settlement', {
    p_organizer_id: organizerId,
    p_cutoff:       cutoff,
    p_fee_rate:     feeRate,
    p_released_by:  releasedBy,
    p_reference:    generateSettlementRef(),
  });
  if (error) {
    console.error('releaseForOrganizer: claim error', error);
    return { organizerId, outcome: 'error', message: 'Database error while claiming the settlement' };
  }
  const claimed = ((data ?? []) as SettlementRow[])[0];
  if (!claimed) {
    return { organizerId, outcome: 'noop', message: 'Nothing to release — already released' };
  }

  const settlement = await sendTransfer(db, claimed, org);
  return { organizerId, outcome: 'released', settlement };
}

export async function retrySettlement(db: Db, settlementId: string, by: string): Promise<ReleaseResult & { organizerId: string }> {
  const { data: existing } = await db.from('settlements').select('organizer_id').eq('id', settlementId).maybeSingle();
  if (!existing) return { organizerId: '', outcome: 'error', message: 'Settlement not found' };
  const org = await loadOrganizer(db, existing.organizer_id);
  if (!org) return { organizerId: existing.organizer_id, outcome: 'error', message: 'Organiser not found' };

  // Re-check the gates that don't depend on the amount (bank details may have changed).
  const blockers = eligibilityBlockers({ organizer: org, releasableNet: 1 });
  if (blockers.length > 0) return { organizerId: org.id, outcome: 'blocked', message: blockers.join('; ') };

  const { data, error } = await db.rpc('begin_settlement_retry', {
    p_settlement_id: settlementId,
    p_reference:     generateSettlementRef(),
    p_initiated_by:  by,
  });
  if (error) {
    console.error('retrySettlement: rpc error', error);
    return { organizerId: org.id, outcome: 'error', message: 'Database error while starting the retry' };
  }
  const row = ((data ?? []) as SettlementRow[])[0];
  if (!row) return { organizerId: org.id, outcome: 'noop', message: 'Only a failed settlement can be retried — it may already be retrying' };
  if (row.status === 'void') return { organizerId: org.id, outcome: 'noop', message: 'Voided — every ticket in it has been refunded, nothing to send' };

  const settlement = await sendTransfer(db, row, org);
  return { organizerId: org.id, outcome: 'released', settlement };
}

/** Asks Paystack for the current state of an in-flight settlement. */
export async function checkSettlementStatus(db: Db, settlementId: string): Promise<{ ok: boolean; message: string; settlement?: SettlementRow }> {
  const { data: s } = await db.from('settlements').select('*').eq('id', settlementId).maybeSingle();
  if (!s) return { ok: false, message: 'Settlement not found' };
  const row = s as SettlementRow;
  if (row.status !== 'processing' && row.status !== 'otp_pending') {
    return { ok: true, message: `Already ${row.status}`, settlement: row };
  }
  if (!row.transfer_reference) return { ok: false, message: 'No transfer reference on record' };

  let outcome: Outcome;
  try {
    const v = await verifyTransfer(row.transfer_reference);
    outcome = v.found
      ? mapPaystackStatus(v.status, v.transferCode, v.failureReason)
      : { status: 'failed', reason: 'Paystack has no record of this transfer' };
  } catch (err) {
    return { ok: false, message: `Paystack lookup failed: ${err instanceof Error ? err.message : 'error'}` };
  }
  if (outcome.status === 'processing' || outcome.status === 'otp_pending') outcome = { ...outcome, note: undefined };
  const updated = await applyTransferOutcome(db, row.transfer_reference, outcome);
  if (updated?.status === 'successful') notifySettlementSuccess(updated);
  const { data: fresh } = await db.from('settlements').select('*').eq('id', settlementId).single();
  return { ok: true, message: `Paystack says: ${outcome.paystackStatus ?? outcome.status}`, settlement: fresh as SettlementRow };
}
