import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle } = await params;
    const { email, phone } = await req.json();

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

    // Upsert on (organizer_id, email): a returning subscriber who had
    // unsubscribed gets cleared back to active rather than erroring.
    const { error } = await db
      .from('organizer_subscribers')
      .upsert(
        {
          organizer_id: organizer.id,
          email: normalizedEmail,
          phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
          unsubscribed_at: null,
        },
        { onConflict: 'organizer_id,email' },
      );

    if (error) throw error;

    // Generic success regardless of prior subscription state — don't leak it.
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/organizers/[handle]/subscribe error', err);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
