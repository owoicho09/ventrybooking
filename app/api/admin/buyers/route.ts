import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search')?.trim();
  const status = searchParams.get('status');

  const db = getServerSupabase();
  let qb = db
    .from('tickets')
    .select('id, buyer_name, buyer_email, total_paid, status, purchased_at, paystack_reference, event_id, organizer_id, event:events(event_name, date), organizer:users!tickets_organizer_id_fkey(name)')
    .order('purchased_at', { ascending: false })
    .limit(500);

  if (status) qb = qb.eq('status', status);
  if (search) qb = qb.or(`buyer_name.ilike.%${search}%,buyer_email.ilike.%${search}%,id.ilike.%${search}%`);

  const { data, error } = await qb;
  if (error) {
    console.error('GET /api/admin/buyers error', error);
    return NextResponse.json({ error: 'Failed to fetch buyers' }, { status: 500 });
  }

  const rows = (data || []).map((t) => {
    const eventRaw = Array.isArray(t.event) ? t.event[0] : t.event;
    const organizerRaw = Array.isArray(t.organizer) ? t.organizer[0] : t.organizer;
    return {
      id:                 t.id,
      buyer_name:         t.buyer_name,
      buyer_email:        t.buyer_email,
      total_paid:         t.total_paid,
      status:             t.status,
      purchased_at:       t.purchased_at,
      paystack_reference: t.paystack_reference,
      event_id:           t.event_id,
      organizer_id:       t.organizer_id,
      event_name:         (eventRaw as { event_name: string } | null)?.event_name || 'Unknown Event',
      event_date:         (eventRaw as { date: string } | null)?.date || null,
      organizer_name:     (organizerRaw as { name: string } | null)?.name || 'Unknown',
    };
  });

  return NextResponse.json({ success: true, data: rows });
}
