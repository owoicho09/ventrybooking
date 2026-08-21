import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// GET — full admin-only profile for one organiser: KYC/profile fields,
// every event with sold/available, all-time ticket + revenue totals,
// their full Audience (names AND emails — the "organisers never see buyer
// emails" rule is about organisers, not Ventry/admin), and their newsletter
// history. This is the "click an organiser, see everything" admin hub.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServerSupabase();

  const { data: org, error: orgErr } = await db
    .from('users')
    .select(`
      id, name, email, phone, handle, avatar_url, socials, tier, verified,
      member_since, created_at, kyc_status, kyc_submitted_at, kyc_gov_id_path,
      kyc_selfie_path, kyc_social_twitter, kyc_social_instagram, kyc_social_facebook,
      kyc_venue_proof_path, kyc_rejection_reason, kyc_phone_verified,
      bank_name, account_number, account_name, platform_fee_rate
    `)
    .eq('id', id)
    .maybeSingle();

  if (orgErr) {
    console.error('GET /api/admin/organizers/[id] error', orgErr);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
  if (!org) return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });

  const [{ data: events }, { data: ticketRows }, { data: audience }, { data: newsletters }] = await Promise.all([
    db
      .from('events')
      .select('id, event_name, slug, status, date, city, tiers:ticket_tiers(sold, available)')
      .eq('organizer_id', id)
      .order('date', { ascending: false }),
    db
      .from('tickets')
      .select('total_paid, status')
      .eq('organizer_id', id),
    db
      .from('organizer_subscribers')
      .select('id, name, email, phone, source, subscribed_at, unsubscribed_at')
      .eq('organizer_id', id)
      .order('subscribed_at', { ascending: false }),
    db
      .from('newsletters')
      .select('id, subject, status, rejection_reason, recipient_count, submitted_at, sent_at')
      .eq('organizer_id', id)
      .order('submitted_at', { ascending: false }),
  ]);

  type TierRow = { sold: number; available: number };
  const eventRows = events ?? [];
  const mappedEvents = eventRows.map(ev => {
    const tiers = (ev.tiers as TierRow[]) ?? [];
    return {
      id: ev.id,
      event_name: ev.event_name,
      slug: ev.slug,
      status: ev.status,
      date: ev.date,
      city: ev.city,
      sold: tiers.reduce((s, t) => s + (t.sold ?? 0), 0),
      available: tiers.reduce((s, t) => s + (t.available ?? 0), 0),
    };
  });

  const totalSold = mappedEvents.reduce((s, e) => s + e.sold, 0);
  const totalAvailable = mappedEvents.reduce((s, e) => s + e.available, 0);
  const totalRevenue = (ticketRows ?? [])
    .filter(t => t.status !== 'refunded')
    .reduce((s, t) => s + (t.total_paid ?? 0), 0);

  return NextResponse.json({
    success: true,
    data: {
      profile: org,
      stats: {
        totalEvents: mappedEvents.length,
        totalSold,
        totalAvailable,
        totalRevenue,
        audienceSize: (audience ?? []).filter(a => !a.unsubscribed_at).length,
      },
      events: mappedEvents,
      audience: audience ?? [],
      newsletters: newsletters ?? [],
    },
  });
}
