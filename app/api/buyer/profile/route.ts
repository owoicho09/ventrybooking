import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getBuyerAuth } from '@/lib/server/buyerAuth';

// One-time first-name capture for a new buyer — the only "registration"
// step that exists, per the passwordless design.
export async function PATCH(req: NextRequest) {
  const buyer = await getBuyerAuth();
  if (!buyer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { firstName } = await req.json();
  const trimmed = String(firstName ?? '').trim().slice(0, 60);
  if (!trimmed) return NextResponse.json({ error: 'First name is required' }, { status: 400 });

  const db = getServerSupabase();
  const { error } = await db
    .from('buyer_profiles')
    .upsert({ email: buyer.email, first_name: trimmed }, { onConflict: 'email' });
  if (error) {
    console.error('PATCH /api/buyer/profile error', error);
    return NextResponse.json({ error: 'Failed to save name' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { firstName: trimmed } });
}
