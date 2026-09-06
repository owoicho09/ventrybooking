import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getBuyerAuth } from '@/lib/server/buyerAuth';

async function getOrganizerId(db: ReturnType<typeof getServerSupabase>, handle: string) {
  const { data } = await db.from('users').select('id').eq('handle', handle.toLowerCase()).maybeSingle();
  return data?.id as string | undefined;
}

// GET — is the signed-in buyer following this organizer? Powers the
// Follow/Following button's initial state.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const buyer = await getBuyerAuth();
  if (!buyer) return NextResponse.json({ success: true, data: { following: false } });

  const { handle } = await params;
  const db = getServerSupabase();
  const organizerId = await getOrganizerId(db, handle);
  if (!organizerId) return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });

  const { data } = await db
    .from('organizer_subscribers')
    .select('id')
    .eq('organizer_id', organizerId)
    .eq('email', buyer.email)
    .eq('source', 'follow')
    .is('unsubscribed_at', null)
    .maybeSingle();

  return NextResponse.json({ success: true, data: { following: !!data } });
}

// POST — follow. Logged-in buyers only; logged-out visitors keep the
// existing Notify Me email-capture flow (the /subscribe route) untouched.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const buyer = await getBuyerAuth();
  if (!buyer) return NextResponse.json({ error: 'Sign in to follow organisers' }, { status: 401 });

  const { handle } = await params;
  const db = getServerSupabase();
  const organizerId = await getOrganizerId(db, handle);
  if (!organizerId) return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });

  const { error } = await db.rpc('upsert_audience_member', {
    p_organizer_id: organizerId,
    p_email:        buyer.email,
    p_name:         null,
    p_phone:        null,
    p_source:       'follow',
  });
  if (error) {
    console.error('POST /api/organizers/[handle]/follow error', error);
    return NextResponse.json({ error: 'Failed to follow' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — unfollow. Marks unsubscribed_at rather than deleting the row,
// matching the existing Notify Me unsubscribe semantics.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const buyer = await getBuyerAuth();
  if (!buyer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { handle } = await params;
  const db = getServerSupabase();
  const organizerId = await getOrganizerId(db, handle);
  if (!organizerId) return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });

  const { error } = await db
    .from('organizer_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('organizer_id', organizerId)
    .eq('email', buyer.email)
    .eq('source', 'follow');
  if (error) {
    console.error('DELETE /api/organizers/[handle]/follow error', error);
    return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
