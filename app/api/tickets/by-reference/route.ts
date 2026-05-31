import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');

  if (!ref) return NextResponse.json({ error: 'Missing ref' }, { status: 400 });

  const db = getServerSupabase();
  const { data } = await db
    .from('tickets')
    .select('id')
    .eq('paystack_reference', ref)
    .maybeSingle();

  if (!data) return NextResponse.json({ success: false, data: null });

  return NextResponse.json({ success: true, data: { id: data.id } });
}
