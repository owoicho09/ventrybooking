import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { generateQRBuffer } from '@/lib/server/qr';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getServerSupabase();

    const { data } = await db
      .from('tickets')
      .select('qr_token')
      .eq('id', id)
      .maybeSingle();

    if (!data?.qr_token) {
      return new NextResponse(null, { status: 404 });
    }

    const buffer = await generateQRBuffer(data.qr_token);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('GET /api/tickets/[id]/qr error:', err);
    return new NextResponse(null, { status: 500 });
  }
}
