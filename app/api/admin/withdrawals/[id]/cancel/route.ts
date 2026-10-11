import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { cancelWithdrawal } from '@/lib/server/withdrawals';

/** Admin closes an open withdrawal request without paying it now. Body: { note? } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { note?: unknown };
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null;
  try {
    const done = await cancelWithdrawal(getServerSupabase(), id, user.email, note);
    if (!done) return NextResponse.json({ error: 'That request is no longer open' }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('cancel withdrawal error', id, err);
    return NextResponse.json({ error: 'Could not close the request' }, { status: 500 });
  }
}
