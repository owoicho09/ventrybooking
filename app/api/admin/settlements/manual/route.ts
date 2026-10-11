import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { loadHolidays, recordManualRelease } from '@/lib/server/settlements';

/**
 * "Mark as paid": the admin has already paid an organiser's releasable
 * balance by bank transfer. Claims those tickets exactly like a release
 * (so they can't be paid twice), records the transfer reference, and runs
 * the post-payout steps (organiser email + notification). No Paystack call.
 *
 * Body: { organizerId, reference, note?, expectedNet }
 * `expectedNet` is the amount the admin saw and paid; if the balance has
 * changed since, nothing is recorded and the new figure is returned.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({})) as { organizerId?: unknown; reference?: unknown; note?: unknown; expectedNet?: unknown };
  if (typeof body.organizerId !== 'string' || !body.organizerId) {
    return NextResponse.json({ error: 'organizerId is required' }, { status: 400 });
  }
  if (typeof body.reference !== 'string' || !body.reference.trim()) {
    return NextResponse.json({ error: 'Enter the bank transfer reference' }, { status: 400 });
  }
  const expectedNet = typeof body.expectedNet === 'number' && Number.isFinite(body.expectedNet) ? body.expectedNet : undefined;
  if (expectedNet == null) {
    return NextResponse.json({ error: 'expectedNet is required' }, { status: 400 });
  }

  const db = getServerSupabase();
  try {
    const holidays = await loadHolidays(db);
    const result = await recordManualRelease(db, body.organizerId, user.email, holidays, {
      reference: body.reference,
      note: typeof body.note === 'string' ? body.note : null,
    }, expectedNet);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('manual settlement error', body.organizerId, err);
    return NextResponse.json({ error: 'Could not record the payment' }, { status: 500 });
  }
}
