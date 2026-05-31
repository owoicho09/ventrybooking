import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { email, ticketId } = await req.json();
    if (!email || !ticketId) {
      return NextResponse.json({ error: 'Email and ticket ID are required' }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data, error } = await db
      .from('tickets')
      .select('id, buyer_email, status')
      .eq('id', ticketId.trim().toUpperCase())
      .ilike('buyer_email', email.trim())   // case-insensitive match
      .maybeSingle();

    if (error) {
      console.error('POST /api/tickets/retrieve Supabase error:', error);
      return NextResponse.json({ error: 'Failed to retrieve ticket' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Ticket not found. Check your email and ticket ID.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: data.id } });
  } catch (err) {
    console.error('POST /api/tickets/retrieve error:', err);
    return NextResponse.json({ error: 'Failed to retrieve ticket' }, { status: 500 });
  }
}
