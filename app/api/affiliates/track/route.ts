import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    const trimmed = String(code ?? '').trim();
    if (!trimmed) {
      return NextResponse.json({ success: true }); // nothing to track, don't error the buyer
    }

    const db = getServerSupabase();
    const { error } = await db.rpc('increment_affiliate_clicks', { p_code: trimmed });
    if (error) console.error('POST /api/affiliates/track rpc error', error);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/affiliates/track error', err);
    return NextResponse.json({ success: true }); // tracking is never allowed to break the buyer flow
  }
}
