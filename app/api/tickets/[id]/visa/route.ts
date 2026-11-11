import { NextRequest, NextResponse } from 'next/server';
import { loadVisaTickets, ensureVisaAssets, renderVisaTicketImages, jpegsToPdf, visaPdfFilename } from '@/lib/server/ijgb/visaTicket';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * IJGB Homecoming visa ticket for one ticket — preview JPEG by default, PDF
 * with ?format=pdf. Same access model as /api/tickets/[id]/qr and
 * /ticket/[id] (the ticket ID is the bearer). 404 for tickets of any other
 * event and for refunded/cancelled tickets.
 *
 * Normally this redirects to the stored copy on the storage CDN (rendered
 * once, on issue); it only renders on the fly if storage is unavailable.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const asPdf = req.nextUrl.searchParams.get('format') === 'pdf';
    const [ticket] = await loadVisaTickets([id]);
    if (!ticket) return new NextResponse(null, { status: 404 });

    const assets = await ensureVisaAssets(ticket);
    if (assets.stored) {
      return NextResponse.redirect(asPdf ? assets.pdfUrl : assets.previewUrl, {
        status: 302,
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    }

    // Storage unavailable: serve the bytes directly.
    let preview = assets.preview;
    let pdf = assets.pdf;
    if (!preview || !pdf) {
      const imgs = await renderVisaTicketImages(ticket);
      preview = imgs.preview;
      pdf = jpegsToPdf([imgs.full]);
    }
    const body = asPdf ? pdf : preview;
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': asPdf ? 'application/pdf' : 'image/jpeg',
        'Content-Disposition': asPdf
          ? `attachment; filename="${visaPdfFilename(ticket.ticketId)}"`
          : 'inline',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    console.error('GET /api/tickets/[id]/visa error:', err);
    return new NextResponse(null, { status: 500 });
  }
}
