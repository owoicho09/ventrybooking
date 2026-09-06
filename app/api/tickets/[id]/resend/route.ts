import { NextRequest, NextResponse } from 'next/server';
import { resendTicketByReference } from '@/lib/server/ticket';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { email } = await req.json();

    const result = await resendTicketByReference(id, (email || '').trim());
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/tickets/[id]/resend error:', err);
    return NextResponse.json({ error: 'Failed to resend ticket' }, { status: 500 });
  }
}
