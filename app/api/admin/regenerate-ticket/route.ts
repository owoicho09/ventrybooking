import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { regenerateTicketForReference } from '@/lib/server/reconcile';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { reference } = await req.json();
  if (!reference || typeof reference !== 'string') {
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
  }

  const result = await regenerateTicketForReference(reference.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  return NextResponse.json({ success: true, ticketId: result.ticketId });
}
