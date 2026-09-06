import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const category = searchParams.get('category');

  const db = getServerSupabase();
  let qb = db
    .from('complaints')
    .select('id, ticket_id, type, category, buyer_email, buyer_name, event_name, submitted_at, status, priority, notes, transcript, ticket:tickets(buyer_name)')
    .order('priority', { ascending: true })
    .order('submitted_at', { ascending: true });

  if (status) qb = qb.eq('status', status);
  if (category) qb = qb.eq('category', category);

  const { data, error } = await qb;
  if (error) return NextResponse.json({ error: 'Failed to fetch complaints' }, { status: 500 });

  const rows = (data || []).map((c) => {
    const ticketRaw = Array.isArray(c.ticket) ? c.ticket[0] : c.ticket;
    return {
      id: c.id,
      ticket_id: c.ticket_id,
      type: c.type,
      category: c.category,
      buyer_name: (ticketRaw as { buyer_name: string } | null)?.buyer_name || c.buyer_name || '',
      buyer_email: c.buyer_email,
      event_name: c.event_name,
      submitted_at: c.submitted_at,
      status: c.status,
      priority: c.priority,
      notes: c.notes,
      transcript: c.transcript,
    };
  });

  return NextResponse.json({ success: true, data: rows });
}
