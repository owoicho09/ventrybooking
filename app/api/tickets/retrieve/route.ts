import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data, error } = await db
      .from('tickets')
      .select(`
        id, status, purchased_at,
        event:events!tickets_event_id_fkey(event_name, date)
      `)
      .ilike('buyer_email', email.trim())
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('POST /api/tickets/retrieve Supabase error:', error);
      return NextResponse.json({ error: 'Failed to retrieve tickets' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No tickets found for that email.' }, { status: 404 });
    }

    type EvRow = { event_name: string; date: string };
    const tickets = data.map(t => {
      const ev = (Array.isArray(t.event) ? t.event[0] : t.event) as EvRow | null;
      return {
        id: t.id,
        status: t.status,
        eventName: ev?.event_name ?? '',
        eventDate: ev?.date ?? '',
      };
    });

    return NextResponse.json({ success: true, data: tickets });
  } catch (err) {
    console.error('POST /api/tickets/retrieve error:', err);
    return NextResponse.json({ error: 'Failed to retrieve tickets' }, { status: 500 });
  }
}
