import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Switch a monitor link off or back on, or rename it: { active?, label? }.
 * Off takes effect on the sponsor's next refresh (within a minute).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, linkId } = await params;

  const body = await req.json().catch(() => ({})) as { active?: unknown; label?: unknown };
  const updates: Record<string, unknown> = {};
  if (typeof body.active === 'boolean') {
    updates.active = body.active;
    updates.deactivated_at = body.active ? null : new Date().toISOString();
  }
  if (body.label !== undefined) updates.label = String(body.label ?? '').trim().slice(0, 80) || null;
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await getServerSupabase()
    .from('monitor_links')
    .update(updates)
    .eq('id', linkId).eq('event_id', id).eq('organizer_id', user.sub)
    .select('id, label, active')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Failed to update link' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}
