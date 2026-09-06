import { NextResponse } from 'next/server';
import { getBuyerAuth } from '@/lib/server/buyerAuth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const buyer = await getBuyerAuth();
  if (!buyer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const db = getServerSupabase();
  const { data: profile } = await db.from('buyer_profiles').select('first_name').eq('email', buyer.email).maybeSingle();

  return NextResponse.json({ success: true, data: { email: buyer.email, firstName: profile?.first_name ?? null } });
}
