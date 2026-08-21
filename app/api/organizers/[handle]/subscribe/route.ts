import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle } = await params;
    const { email, phone, name } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: organizer } = await db
      .from('users')
      .select('id')
      .eq('handle', handle.toLowerCase())
      .maybeSingle();

    if (!organizer) {
      return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Reactivating upsert on (organizer_id, email): a returning subscriber
    // who had unsubscribed gets cleared back to active rather than erroring.
    // Shared with the ticket-purchase consent path so both membership
    // sources land in the same Audience table under one unsubscribe token.
    const { error } = await db.rpc('upsert_audience_member', {
      p_organizer_id: organizer.id,
      p_email:        normalizedEmail,
      p_name:         typeof name === 'string' && name.trim() ? name.trim() : null,
      p_phone:        typeof phone === 'string' && phone.trim() ? phone.trim() : null,
      p_source:       'notify_me',
    });

    if (error) throw error;

    // Generic success regardless of prior subscription state — don't leak it.
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/organizers/[handle]/subscribe error', err);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
