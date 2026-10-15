import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Organiser picks how they're paid: 'bank' (each day's sales settled to their
 * bank the next working day) or 'wallet' (sales stay in their Ventry wallet
 * until they tap Withdraw). Switching back to bank pays the whole balance in
 * the next daily release.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { method } = await req.json().catch(() => ({}));
  if (method !== 'bank' && method !== 'wallet') {
    return NextResponse.json({ error: 'Choose bank or wallet' }, { status: 400 });
  }
  const { error } = await getServerSupabase().from('users').update({ payout_method: method }).eq('id', user.sub);
  if (error) {
    console.error('POST /api/organizer/wallet/method error', error.message);
    return NextResponse.json({ error: 'Could not save your choice' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { method } });
}
