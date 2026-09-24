import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  eligibilityBlockers, feeRateOf, lagosDate, loadHolidays, loadUnsettled,
  releaseCutoff, summarizePending, type OrganizerRow,
} from '@/lib/server/settlements';

/** One organiser's settlement history: pending (releasable + accruing) and every settlement with its attempts. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;

  try {
    const db = getServerSupabase();
    const { data: orgData } = await db
      .from('users')
      .select('id, name, email, bank_name, account_number, account_name, platform_fee_rate')
      .eq('id', id)
      .maybeSingle();
    if (!orgData) return NextResponse.json({ error: 'Organiser not found' }, { status: 404 });
    const org = orgData as OrganizerRow;

    const [holidays, unsettled, settlementsRes] = await Promise.all([
      loadHolidays(db),
      loadUnsettled(db, id),
      db.from('settlements')
        .select('*, attempts:settlement_attempts(attempt_no, transfer_reference, amount, initiated_by, initiated_at, status, paystack_status, failure_reason, finished_at)')
        .eq('organizer_id', id)
        .order('released_at', { ascending: false }),
    ]);
    if (settlementsRes.error) throw new Error(settlementsRes.error.message);

    const cutoff  = releaseCutoff(lagosDate(), holidays);
    const u       = unsettled.get(id);
    const pending = summarizePending(u?.days ?? [], u?.owed ?? null, feeRateOf(org), cutoff, holidays);
    const blockers = pending.releasable
      ? eligibilityBlockers({ organizer: org, releasableNet: pending.releasable.net })
      : [];

    return NextResponse.json(
      {
        success: true,
        data: {
          organizer: {
            id: org.id, name: org.name, email: org.email,
            bankName: org.bank_name, accountNumber: org.account_number, accountName: org.account_name,
            feeRate: feeRateOf(org),
          },
          pending,
          blockers,
          settlements: settlementsRes.data ?? [],
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('GET settlement history error', id, err);
    return NextResponse.json({ error: 'Failed to load settlement history' }, { status: 500 });
  }
}
