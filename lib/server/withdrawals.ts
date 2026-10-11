import { getServerSupabase } from '@/lib/supabase/server';
import {
  ORGANIZER_COLUMNS, UNVERIFIED_SETTLEMENT_CAP, feeRateOf, lagosDate, loadHolidays, loadSettledTotals,
  loadUnsettled, releaseCutoff, summarizePending, type OrganizerRow,
} from '@/lib/server/settlements';
import { notify } from '@/lib/server/notify';
import { getBankCode } from '@/lib/banks';

type Db = ReturnType<typeof getServerSupabase>;

// The organiser's wallet: what's available to withdraw now (sales already
// due under next-working-day settlement), what's still accruing, and an
// optional "withdraw now" request the admin pays with the usual Release or
// "Mark as paid". Settlement itself is unchanged.

export interface WithdrawalRequest {
  id: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  requested_at: string;
  resolved_at: string | null;
  note: string | null;
}

export interface Wallet {
  /** Net available now (eligible for release), after fee, refunds and deductions. */
  available: number;
  /** Next amount still accruing, and when it becomes available. */
  next: { amount: number; on: string } | null;
  /** Why "withdraw now" can't be used, in the organiser's terms; empty if it can. */
  blockers: string[];
  pendingRequest: WithdrawalRequest | null;
  lastRequest: WithdrawalRequest | null;
}

const fmt = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

/** Organiser-facing reasons a withdrawal can't be paid right now. */
function organizerBlockers(org: OrganizerRow, available: number, settledTotal: number): string[] {
  const out: string[] = [];
  if (!org.account_number) out.push('Add your payout bank account first.');
  else if (!getBankCode(org.bank_name || '')) out.push('We don’t recognise your bank. Update your bank details.');
  if (org.bank_name_matched === false) out.push('Your bank account isn’t in your verified name. Add an account in your own name.');
  if (org.identity_status !== 'verified' && settledTotal + available > UNVERIFIED_SETTLEMENT_CAP) {
    out.push(`You’ve reached the ${fmt(UNVERIFIED_SETTLEMENT_CAP)} limit for unverified organisers. Verify your identity to keep withdrawing.`);
  }
  return out;
}

export async function loadWallet(db: Db, organizerId: string): Promise<Wallet> {
  const [orgRes, holidays, unsettled, settledTotals, requestsRes] = await Promise.all([
    db.from('users').select(ORGANIZER_COLUMNS).eq('id', organizerId).maybeSingle(),
    loadHolidays(db),
    loadUnsettled(db, organizerId),
    loadSettledTotals(db, [organizerId]),
    db.from('withdrawal_requests').select('id, amount, status, requested_at, resolved_at, note')
      .eq('organizer_id', organizerId).order('requested_at', { ascending: false }).limit(5),
  ]);
  const org = orgRes.data as unknown as OrganizerRow | null;
  if (!org) throw new Error('Organiser not found');

  const u = unsettled.get(organizerId);
  const pending = summarizePending(u?.days ?? [], u?.owed ?? null, feeRateOf(org), releaseCutoff(lagosDate(), holidays), holidays, u?.adjustments);
  const available = Math.max(0, Math.round(pending.releasable?.net ?? 0));
  const first = pending.accruing[0];
  const requests = ((requestsRes.data ?? []) as WithdrawalRequest[]).map(r => ({ ...r, amount: Number(r.amount) }));

  return {
    available,
    next: first ? { amount: Math.round(first.net), on: first.eligibleOn } : null,
    blockers: available > 0 ? organizerBlockers(org, available, settledTotals.get(organizerId) ?? 0) : [],
    pendingRequest: requests.find(r => r.status === 'pending') ?? null,
    lastRequest: requests[0] ?? null,
  };
}

export type RequestResult = { ok: true; request: WithdrawalRequest } | { ok: false; error: string; status: number };

/** "Withdraw now": record the request and alert the admin straight away. */
export async function requestWithdrawal(db: Db, organizerId: string): Promise<RequestResult> {
  const wallet = await loadWallet(db, organizerId);
  if (wallet.pendingRequest) return { ok: false, error: 'You already have a withdrawal request waiting to be paid.', status: 409 };
  if (wallet.available <= 0) return { ok: false, error: 'Nothing is available to withdraw yet.', status: 400 };
  if (wallet.blockers.length > 0) return { ok: false, error: wallet.blockers.join(' '), status: 400 };

  const { data, error } = await db.from('withdrawal_requests')
    .insert({ organizer_id: organizerId, amount: wallet.available })
    .select('id, amount, status, requested_at, resolved_at, note')
    .single();
  if (error) {
    // The unique index: a second tap raced the first.
    if (error.code === '23505') return { ok: false, error: 'You already have a withdrawal request waiting to be paid.', status: 409 };
    throw new Error(error.message);
  }

  const { data: org } = await db.from('users').select('name').eq('id', organizerId).maybeSingle();
  notify(
    { type: 'admin' },
    {
      notifType: 'payout',
      title: `Withdrawal requested: ${fmt(wallet.available)}`,
      body: `${org?.name ?? 'An organiser'} asked to withdraw ${fmt(wallet.available)} now. Pay it with Release or "Mark as paid" on their payouts page; the request closes itself when the payout succeeds.`,
      link: `/admin/payouts/${organizerId}`,
    },
    { emailChannel: 'immediate' },
  ).catch(err => console.error('withdrawal: admin notify error', err));

  return { ok: true, request: { ...(data as WithdrawalRequest), amount: Number(data.amount) } };
}

/** Called once a settlement succeeds: closes the organiser's open request. */
export async function closeWithdrawalOnSettlement(organizerId: string, settlementId: string) {
  const db = getServerSupabase();
  const { error } = await db.from('withdrawal_requests')
    .update({ status: 'paid', settlement_id: settlementId, resolved_at: new Date().toISOString(), resolved_by: 'settlement' })
    .eq('organizer_id', organizerId)
    .eq('status', 'pending');
  if (error) console.error('withdrawal: close on settlement error', error.message);
}

/** Admin declines an open request (with a reason the organiser sees). */
export async function cancelWithdrawal(db: Db, requestId: string, by: string, note: string | null) {
  const { data, error } = await db.from('withdrawal_requests')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString(), resolved_by: by, note })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id, organizer_id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    notify(
      { type: 'organizer', id: data.organizer_id },
      {
        notifType: 'payout',
        title: 'Withdrawal request closed',
        body: note ? `Your withdrawal request was closed: ${note}` : 'Your withdrawal request was closed. Your balance will be paid in the normal next-working-day settlement.',
        link: '/organizer/payouts',
      },
    ).catch(console.error);
  }
  return !!data;
}
