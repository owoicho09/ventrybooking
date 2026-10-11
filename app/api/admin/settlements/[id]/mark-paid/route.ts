import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { markSettlementPaidManually } from '@/lib/server/settlements';

/** A failed Paystack settlement the admin has paid by bank transfer instead. Body: { reference, note? } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { reference?: unknown; note?: unknown };
  if (typeof body.reference !== 'string' || !body.reference.trim()) {
    return NextResponse.json({ error: 'Enter the bank transfer reference' }, { status: 400 });
  }
  try {
    const result = await markSettlementPaidManually(getServerSupabase(), id, user.email, {
      reference: body.reference,
      note: typeof body.note === 'string' ? body.note : null,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('settlement mark-paid error', id, err);
    return NextResponse.json({ error: 'Could not record the payment' }, { status: 500 });
  }
}
