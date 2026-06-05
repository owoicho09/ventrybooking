import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { initiateTransfer, createTransferRecipient } from '@/lib/server/paystack';
import { generatePayoutRef } from '@/lib/server/ids';
import { getBankCode } from '@/lib/banks';
import { notify } from '@/lib/server/notify';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    // If no percentage is passed in the request body, fall back to the platform-wide
    // payout_percentage setting configured by the admin in Settings.
    let releasePercent = Number(body.percentage ?? NaN);
    if (!Number.isFinite(releasePercent) || releasePercent <= 0) {
      const db2 = getServerSupabase();
      const { data: cfg } = await db2.from('platform_config').select('value').eq('key', 'payout_percentage').maybeSingle();
      releasePercent = Number(cfg?.value ?? 100);
    }
    releasePercent = Math.min(100, Math.max(0, releasePercent || 100));

    const db = getServerSupabase();

    const { data: payout, error: payoutErr } = await db
      .from('payouts')
      .select('id, net, organizer_id, event_name, status')
      .eq('id', id)
      .maybeSingle();

    if (payoutErr) {
      console.error('release payout: DB error', payoutErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    if (payout.status !== 'processing') {
      return NextResponse.json({ error: 'Event must be confirmed before release' }, { status: 400 });
    }

    const { data: org, error: orgErr } = await db
      .from('users')
      .select('name, account_number, account_name, bank_name')
      .eq('id', payout.organizer_id)
      .maybeSingle();

    if (orgErr) {
      console.error('release payout: org DB error', orgErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!org?.account_number) {
      return NextResponse.json({ error: 'Organizer has no bank account on file' }, { status: 400 });
    }

    const bankCode = getBankCode(org.bank_name || '');
    if (!bankCode) {
      return NextResponse.json(
        { error: `Unknown bank "${org.bank_name}". Ask the organizer to update their bank details.` },
        { status: 400 }
      );
    }

    const releaseAmount = Math.round(payout.net * (releasePercent / 100));
    const transferRef   = generatePayoutRef();

    // Initiate the Paystack transfer. Any failure surfaces as an error to the
    // admin so they can retry — never silently mark completed on failure.
    const recipient = await createTransferRecipient({
      type:           'nuban',
      name:           org.account_name || org.name,
      account_number: org.account_number,
      bank_code:      bankCode,
      currency:       'NGN',
    });

    await initiateTransfer({
      source:    'balance',
      amount:    releaseAmount * 100, // kobo
      recipient: recipient.recipient_code,
      reason:    `Ventry payout for ${payout.event_name}`,
      reference: transferRef,
    });

    // Atomic guard: only update if status is still 'processing'. If a
    // concurrent release request won the race, 0 rows are updated and we
    // return a conflict rather than completing a double-transfer.
    const { data: updated } = await db
      .from('payouts')
      .update({
        status:      'completed',
        reference:   transferRef,
        released_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'processing')
      .select('id');

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Payout was already released by a concurrent request' }, { status: 409 });
    }

    const fmt = (n: number) =>
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

    notify(
      { type: 'organizer', id: payout.organizer_id },
      {
        notifType: 'payout',
        title:     `Payout released — ${payout.event_name}`,
        body:      `${fmt(releaseAmount)} has been transferred to your ${org.bank_name} account.`,
        link:      '/organizer/payouts',
      },
    ).catch(err => console.error('release payout: notify error', err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('release payout error:', err);
    return NextResponse.json({ error: 'Failed to release payout' }, { status: 500 });
  }
}
