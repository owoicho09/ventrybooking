import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { requestWithdrawal } from '@/lib/server/withdrawals';
import { checkRateLimit } from '@/lib/server/rateLimit';

/** "Withdraw now": asks the admin to pay the organiser's available balance today. */
export async function POST() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!checkRateLimit(`withdraw:${user.sub}`, 5, 60 * 60)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }
  try {
    const r = await requestWithdrawal(getServerSupabase(), user.sub);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ success: true, data: r.request });
  } catch (err) {
    console.error('POST /api/organizer/wallet/withdraw error', err);
    return NextResponse.json({ error: 'Could not send your request. Please try again.' }, { status: 500 });
  }
}
