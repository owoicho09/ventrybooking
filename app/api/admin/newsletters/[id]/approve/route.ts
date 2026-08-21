import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendNewsletterEmail, sendNewsletterSentConfirmationEmail } from '@/lib/server/email';
import { checkNewsletterEntitlement } from '@/lib/server/entitlements';
import { notify } from '@/lib/server/notify';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// POST — admin approves a mail. Sending happens synchronously here: nothing
// reaches a real inbox until this runs. On completion, every recipient is
// logged to newsletter_sends (Goal 6's usage trail) and the organiser gets a
// confirmation email.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServerSupabase();

  const { data: newsletter } = await db
    .from('newsletters')
    .select('id, organizer_id, subject, body, image_urls, status')
    .eq('id', id)
    .maybeSingle();

  if (!newsletter) return NextResponse.json({ error: 'Mail not found' }, { status: 404 });
  if (newsletter.status !== 'pending') {
    return NextResponse.json({ error: 'This mail has already been reviewed' }, { status: 400 });
  }

  const entitlement = await checkNewsletterEntitlement(newsletter.organizer_id);
  if (!entitlement.allowed) {
    return NextResponse.json({ error: entitlement.reason }, { status: 402 });
  }

  const { data: organizer } = await db
    .from('users')
    .select('name, email')
    .eq('id', newsletter.organizer_id)
    .maybeSingle();

  const { data: audience, error: audienceErr } = await db
    .from('organizer_subscribers')
    .select('email, unsubscribe_token')
    .eq('organizer_id', newsletter.organizer_id)
    .is('unsubscribed_at', null);

  if (audienceErr) {
    console.error('approve newsletter: audience lookup error', audienceErr);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  const recipients = audience ?? [];
  const organizerName = organizer?.name || 'An organiser';
  const imageUrls: string[] = Array.isArray(newsletter.image_urls) ? newsletter.image_urls : [];

  const results = await Promise.allSettled(
    recipients.map(r =>
      sendNewsletterEmail({
        to:             r.email,
        organizerName,
        subject:        newsletter.subject,
        body:           newsletter.body,
        imageUrls,
        unsubscribeUrl: `${APP_URL}/api/subscribers/unsubscribe?token=${r.unsubscribe_token}`,
      }),
    ),
  );

  const sendLogRows = recipients.map((r, i) => ({
    newsletter_id:   id,
    organizer_id:    newsletter.organizer_id,
    recipient_email: r.email,
    status:          results[i].status === 'fulfilled' ? 'sent' : 'failed',
  }));
  if (sendLogRows.length > 0) {
    const { error: logErr } = await db.from('newsletter_sends').insert(sendLogRows);
    if (logErr) console.error('approve newsletter: send-log insert error', logErr);
  }

  const sentCount = results.filter(r => r.status === 'fulfilled').length;
  const failedCount = results.length - sentCount;
  if (failedCount > 0) {
    console.error(`approve newsletter ${id}: ${failedCount} of ${results.length} sends failed`);
  }

  const nowIso = new Date().toISOString();
  await db
    .from('newsletters')
    .update({ status: 'approved', reviewed_at: nowIso, sent_at: nowIso, recipient_count: recipients.length })
    .eq('id', id);

  if (organizer?.email) {
    sendNewsletterSentConfirmationEmail({
      to:             organizer.email,
      organizerName,
      subject:        newsletter.subject,
      recipientCount: sentCount,
    }).catch(err => console.error('approve newsletter: confirmation email error', err));
  }

  notify(
    { type: 'organizer', id: newsletter.organizer_id },
    {
      notifType: 'newsletter',
      title:     `Mail sent — "${newsletter.subject}"`,
      body:      `Approved and delivered to ${sentCount} recipient${sentCount !== 1 ? 's' : ''}.`,
      link:      '/organizer/audience',
    },
  ).catch(console.error);

  return NextResponse.json({ success: true, data: { sent: sentCount, failed: failedCount } });
}
