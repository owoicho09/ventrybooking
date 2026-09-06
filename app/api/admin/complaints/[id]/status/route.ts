import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendComplaintStatusEmail } from '@/lib/server/email';

const ALLOWED = ['open', 'investigating', 'resolved'];

// Generic status control for complaints that aren't a refund request — those
// keep using approve-refund/reject, which have their own money-moving logic.
// This route only ever changes status and notifies the buyer.
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
    const { status } = await req.json();
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: complaint, error: fetchErr } = await db
      .from('complaints')
      .select('buyer_email, event_name')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    const { error } = await db.from('complaints').update({ status }).eq('id', id);
    if (error) throw error;

    if (complaint.buyer_email && complaint.buyer_email !== 'unknown@ventrybooking.com') {
      sendComplaintStatusEmail(complaint.buyer_email, id, status, complaint.event_name || '')
        .catch(err => console.error('sendComplaintStatusEmail error', err));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/complaints/[id]/status error', err);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
