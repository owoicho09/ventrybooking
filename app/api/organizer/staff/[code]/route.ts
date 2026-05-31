import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;
  const { active } = await req.json() as { active?: boolean };

  const db = getServerSupabase();
  const { error } = await db
    .from('staff_ids')
    .update({ active: active ?? false })
    .eq('code', code)
    .eq('organizer_id', user.sub); // ensure the organizer owns this code

  if (error) return NextResponse.json({ error: 'Failed to update staff ID' }, { status: 500 });
  return NextResponse.json({ success: true });
}
