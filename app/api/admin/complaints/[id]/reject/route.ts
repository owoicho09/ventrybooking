import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

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
    const { error } = await db
      .from('complaints')
      .update({ status: 'rejected', notes: notes || '' })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('reject complaint error', err);
    return NextResponse.json({ error: 'Failed to reject complaint' }, { status: 500 });
  }
}
