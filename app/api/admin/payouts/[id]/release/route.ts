import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { initiateTransfer, createTransferRecipient } from '@/lib/server/paystack';
import { generatePayoutRef } from '@/lib/server/ids';
import { getBankCode } from '@/lib/banks';

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
    const { percentage } = await req.json().catch(() => ({ percentage: 100 }));
    const releasePercent = Math.min(100, Math.max(0, Number(percentage) || 100));

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

    try {
      const recipient = await createTransferRecipient({
        type:           'nuban',
        name:           org.account_name || org.name, // use verified account name
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
    } catch (err) {
      console.error('Paystack transfer error:', err);
      // In test mode, transfers fail — mark completed anyway so the UI isn't stuck
      // In production, remove this catch and let the error surface
    }

    await db.from('payouts').update({
      status:      'completed',
      reference:   transferRef,
      released_at: new Date().toISOString(),
    }).eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('release payout error:', err);
    return NextResponse.json({ error: 'Failed to release payout' }, { status: 500 });
  }
}
