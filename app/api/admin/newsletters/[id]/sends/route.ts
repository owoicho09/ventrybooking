import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// GET — per-recipient delivery log for one newsletter. Written at approve
// time (see .../newsletters/[id]/approve) but never surfaced anywhere
// until now.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServerSupabase();

  const { data, error } = await db
    .from('newsletter_sends')
    .select('recipient_email, status, sent_at')
    .eq('newsletter_id', id)
    .order('sent_at', { ascending: false });

  if (error) {
    console.error('GET /api/admin/newsletters/[id]/sends error', error);
    return NextResponse.json({ error: 'Failed to fetch send log' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
