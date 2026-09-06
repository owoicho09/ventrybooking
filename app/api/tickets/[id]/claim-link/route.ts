import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { signTicketLink } from '@/lib/server/ticketLinks';

// Kept separate from GET /api/tickets/[id] (used more broadly) rather than
// adding the claim token to that response, so this stronger capability
// — logging into every order on the ticket's email, not just viewing this
// one ticket — stays scoped to the one UI flow that actually needs it.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getServerSupabase();
  const { data: ticket } = await db.from('tickets').select('id').eq('id', id).maybeSingle();
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  const token = signTicketLink({ ticketId: id, purpose: 'buyer_claim' }, 30 * 24 * 60 * 60);
  return NextResponse.json({ success: true, data: { url: `/api/buyer/auth/claim?token=${token}` } });
}
