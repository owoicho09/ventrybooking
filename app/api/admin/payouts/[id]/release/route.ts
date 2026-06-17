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

    if (payout.status === 'completed') {
      return NextResponse.json({ error: 'Payout already completed' }, { status: 400 });
    }
    // otp_pending means the transfer was initiated but Paystack is waiting for OTP
    // confirmation. The transfer.success webhook will flip it to completed.
    if (payout.status === 'otp_pending') {
      return NextResponse.json(
        { error: 'Transfer is awaiting OTP confirmation — check your Paystack dashboard to approve it' },
        { status: 400 },
      );
    }
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
        { status: 400 },
      );
    }

    const releaseAmount = Math.round(payout.net * (releasePercent / 100));
    const transferRef   = generatePayoutRef();

    const recipient = await createTransferRecipient({
      type:           'nuban',
      name:           org.account_name || org.name,
      account_number: org.account_number,
      bank_code:      bankCode,
      currency:       'NGN',
    });

    const transfer = await initiateTransfer({
      source:    'balance',
      amount:    releaseAmount * 100, // kobo
      recipient: recipient.recipient_code,
      reason:    `Ventry payout for ${payout.event_name}`,
      reference: transferRef,
    });

    // In live mode without OTP disabled, Paystack returns status='otp' — the transfer
    // is queued but not yet sent. We store the reference now so the transfer.success
    // webhook can find and complete this payout row. We do NOT mark it completed until
    // Paystack confirms via webhook. In test mode (or with OTP disabled) status='success'
    // and the webhook will still arrive, which is idempotent.
    const transferStatus  = (transfer as { status?: string }).status;
    const newPayoutStatus = transferStatus === 'success' ? 'completed' : 'otp_pending';

    // Atomic guard: only update if status is still 'processing'. A concurrent release
    // request winning the race will find 0 rows and receive a conflict response.
    const { data: updated } = await db
      .from('payouts')
      .update({
        status:      newPayoutStatus,
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

    if (newPayoutStatus === 'completed') {
      notify(
        { type: 'organizer', id: payout.organizer_id },
        {
          notifType: 'payout',
          title:     `Payout released — ${payout.event_name}`,
          body:      `${fmt(releaseAmount)} has been transferred to your ${org.bank_name} account.`,
          link:      '/organizer/payouts',
        },
      ).catch(err => console.error('release payout: notify error', err));
    } else {
      // OTP confirmation pending — notify organizer to expect a delay
      notify(
        { type: 'organizer', id: payout.organizer_id },
        {
          notifType: 'payout',
          title:     `Payout initiated — ${payout.event_name}`,
          body:      `${fmt(releaseAmount)} transfer is pending final confirmation. You will be notified once it clears.`,
          link:      '/organizer/payouts',
        },
      ).catch(err => console.error('release payout: notify error', err));
    }

    return NextResponse.json({
      success: true,
      data: {
        status: newPayoutStatus,
        ...(newPayoutStatus === 'otp_pending' && {
          message: 'Transfer initiated but requires OTP confirmation on your Paystack dashboard before funds are sent.',
        }),
      },
    });
  } catch (err) {
    console.error('release payout error:', err);
    return NextResponse.json({ error: 'Failed to release payout' }, { status: 500 });
  }
}
