import { NextRequest, NextResponse } from 'next/server';
import { generateQRBuffer } from '@/lib/server/qr';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
    if (!APP_URL) {
      console.error('NEXT_PUBLIC_APP_URL is not set — QR codes cannot be generated');
      return new NextResponse(null, { status: 500 });
    }
    const { id } = await params;
    const buffer = await generateQRBuffer(`${APP_URL}/scan/${id}`);

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
