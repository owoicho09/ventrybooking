import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendKYCRejectedEmail } from '@/lib/server/email';
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
    const { reason } = await req.json();
    if (!reason) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });

    const db = getServerSupabase();
    const { data: org } = await db.from('users').select('name, email').eq('id', id).single();
    if (!org) return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });

    await db.from('users').update({ kyc_status: 'rejected', kyc_rejection_reason: reason }).eq('id', id);
    await sendKYCRejectedEmail(org.email, org.name, reason).catch(console.error);
    notify(
      { type: 'organizer', id },
      { notifType: 'kyc', title: 'KYC Review Update', body: `Your verification was not approved: ${reason}`, link: '/organizer/settings' },
    ).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('reject organizer error', err);
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
  }
}
