import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { retrySettlement } from '@/lib/server/settlements';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const result = await retrySettlement(getServerSupabase(), id, user.email);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('settlement retry error', id, err);
    return NextResponse.json({ error: 'Retry failed' }, { status: 500 });
  }
}
