import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bankName, accountNumber, accountName } = await req.json();
    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'All bank fields are required' }, { status: 400 });
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Account number must be 10 digits' }, { status: 400 });
    }

    const db = getServerSupabase();
    await db.from('users').update({
      bank_name: bankName,
      account_number: accountNumber,
      account_name: accountName,
    }).eq('id', user.sub);

    return NextResponse.json({ success: true, data: { message: 'Bank details saved' } });
  } catch (err) {
    console.error('POST /api/organizer/bank error', err);
    return NextResponse.json({ error: 'Failed to save bank details' }, { status: 500 });
  }
}
