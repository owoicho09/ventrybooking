import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendKYCApprovedEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data: org } = await db.from('users').select('name, email').eq('id', id).single();
    if (!org) return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });

    await db.from('users').update({ kyc_status: 'approved', verified: true }).eq('id', id);
    await sendKYCApprovedEmail(org.email, org.name).catch(console.error);
    notify(
      { type: 'organizer', id },
      { notifType: 'kyc', title: 'KYC Approved', body: 'Your identity verification has been approved. You can now create events.', link: '/organizer/events/create' },
    ).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('approve organizer error', err);
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
  }
}
