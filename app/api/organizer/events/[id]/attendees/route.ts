import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getServerSupabase();

    // Verify ownership
    const { data: event } = await db
      .from('events')
      .select('id, event_name, organizer_id')
      .eq('id', id)
      .eq('organizer_id', user.sub)
      .maybeSingle();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: tickets, error } = await db
      .from('tickets')
      .select(`
        id, buyer_name, buyer_email, paystack_reference, purchased_at, marketing_consent,
        tier:ticket_tiers!tickets_tier_id_fkey(name)
      `)
      .eq('event_id', id)
      .neq('status', 'refunded')
      .order('purchased_at', { ascending: true });

    if (error) throw error;

    // Group by paystack_reference (one CSV row per order)
    type RawTicket = {
      id: string;
      buyer_name: string;
      buyer_email: string;
      paystack_reference: string;
      purchased_at: string;
      marketing_consent: boolean;
      tier: { name: string } | { name: string }[] | null;
    };

    const orderMap = new Map<string, {
      buyerName: string;
      buyerEmail: string;
      tierName: string;
      quantity: number;
      purchasedAt: string;
      marketingConsent: boolean;
    }>();

    for (const ticket of (tickets || []) as RawTicket[]) {
      const ref       = ticket.paystack_reference;
      const tierName  = Array.isArray(ticket.tier) ? ticket.tier[0]?.name : ticket.tier?.name ?? 'Unknown';
      if (!orderMap.has(ref)) {
        orderMap.set(ref, {
          buyerName:        ticket.buyer_name,
          buyerEmail:       ticket.buyer_email,
          tierName,
          quantity:         1,
          purchasedAt:      ticket.purchased_at,
          marketingConsent: ticket.marketing_consent ?? false,
        });
      } else {
        orderMap.get(ref)!.quantity += 1;
      }
    }

    const csvEscape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

    const header = ['Buyer Name', 'Email', 'Ticket Tier', 'Quantity', 'Purchase Date', 'Marketing Consent'];
    const rows   = Array.from(orderMap.values()).map(o => [
      csvEscape(o.buyerName),
      csvEscape(o.buyerEmail),
      csvEscape(o.tierName),
      String(o.quantity),
      csvEscape(new Date(o.purchasedAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })),
      o.marketingConsent ? 'Yes' : 'No',
    ]);

    const csv = [header.map(csvEscape).join(','), ...rows.map(r => r.join(','))].join('\n');

    const filename = `${event.event_name.replace(/[^a-zA-Z0-9]/g, '_')}_attendees.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('GET /api/organizer/events/[id]/attendees error', err);
    return NextResponse.json({ error: 'Failed to generate attendee list' }, { status: 500 });
  }
}
