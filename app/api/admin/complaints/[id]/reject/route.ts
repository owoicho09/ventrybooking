import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendComplaintStatusEmail } from '@/lib/server/email';

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
    const { notes } = await req.json();

    const db = getServerSupabase();
    const { data: complaint } = await db.from('complaints').select('buyer_email, event_name').eq('id', id).maybeSingle();

    const { error } = await db
      .from('complaints')
      .update({ status: 'rejected', notes: notes || '' })
      .eq('id', id);

    if (error) throw error;

    if (complaint?.buyer_email && complaint.buyer_email !== 'unknown@ventrybooking.com') {
      sendComplaintStatusEmail(complaint.buyer_email, id, 'rejected', complaint.event_name || '')
        .catch(err => console.error('sendComplaintStatusEmail error', err));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('reject complaint error', err);
    return NextResponse.json({ error: 'Failed to reject complaint' }, { status: 500 });
  }
}
