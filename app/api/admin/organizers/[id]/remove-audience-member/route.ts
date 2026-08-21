import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// POST — admin removes one person from an organiser's Audience (moderation
// action). Sets unsubscribed_at rather than deleting, matching the existing
// unsubscribe-link behavior — the row (and its unsubscribe_token) stays
// intact so a future genuine re-subscribe still works normally.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const memberId = typeof body.memberId === 'string' ? body.memberId : null;
  if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 });

  const db = getServerSupabase();
  const { error } = await db
    .from('organizer_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('organizer_id', id);

  if (error) {
    console.error('remove-audience-member error', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
