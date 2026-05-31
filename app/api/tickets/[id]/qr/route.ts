import { NextRequest, NextResponse } from 'next/server';
import { generateQRBuffer } from '@/lib/server/qr';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const buffer = await generateQRBuffer(id);

    return new NextResponse(new Uint8Array(buffer), {
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
