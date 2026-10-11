import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { cancelEvent, previewCancellation, runRefundJobs } from '@/lib/server/refundCases';

// Cancelling an event (Refund Policy v3 §2, §6; Organiser Terms §10.9–10.11).
// Ventry refunds the base price itself only where it still holds the money
// (tickets not yet settled). Every other paid ticket gets a refund ID and a
// 30-day claim window; the organiser pays from the claim list at the end.

export const maxDuration = 60;

// GET — preview for the confirm dialog (no side effects).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const db = getServerSupabase();
  const { data: event } = await db.from('events').select('id, event_name, status').eq('id', id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.status !== 'approved') return NextResponse.json({ error: 'Only live events can be cancelled' }, { status: 400 });

  const p = await previewCancellation(db, id);
  return NextResponse.json({
    success: true,
    data: {
      eventName: event.event_name,
      ticketCount: p.held + p.settled + p.free,
      heldCount: p.held, heldAmount: p.heldAmount,
      settledCount: p.settled, settledAmount: p.settledAmount,
      freeCount: p.free,
    },
  });
}

// POST — cancel: refund held money, open the claim window, start the day-0 emails.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { reason } = await req.json().catch(() => ({})) as { reason?: string };
  const db = getServerSupabase();
  try {
    const out = await cancelEvent(db, id, { adminId: user.sub, adminEmail: user.email ?? 'admin', reason: reason?.slice(0, 500) ?? null });
    // Day-0 notices: as many as fit now; the hourly cron sends the rest.
    await runRefundJobs(25_000, out.caseId).catch(err => console.error('cancel: first notices failed', err));
    return NextResponse.json({ success: true, data: out });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cancellation failed';
    console.error('cancel event error', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
