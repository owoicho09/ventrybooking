import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { hidden } = await req.json().catch(() => ({}));
  if (typeof hidden !== 'boolean') {
    return NextResponse.json({ error: 'hidden must be a boolean' }, { status: 400 });
  }

  const db = getServerSupabase();
  const { error } = await db
    .from('event_reviews')
    .update({
      hidden,
      hidden_by: hidden ? user.email : null,
      hidden_at: hidden ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (error) {
    console.error('PATCH /api/admin/reviews/[id] error', error);
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
