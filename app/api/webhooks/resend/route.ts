import { NextRequest, NextResponse } from 'next/server';
import { adminRecipients, isAdminRecipient } from '@/lib/server/adminRecipients';
import { sendToAdmins, adminInboxFailingHtml } from '@/lib/server/email';
import crypto from 'crypto';
import { getServerSupabase } from '@/lib/supabase/server';
import { notify } from '@/lib/server/notify';

// Resend signs webhooks using the Svix format: headers svix-id / svix-timestamp
// / svix-signature, secret shaped "whsec_<base64>". Verifying by hand here
// rather than pulling in the svix package for three lines of HMAC.
function verifySignature(body: string, headers: { id: string; timestamp: string; signature: string }, secret: string): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${headers.id}.${headers.timestamp}.${body}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  return headers.signature
    .split(' ')
    .map(part => part.split(',')[1])
    .filter(Boolean)
    .some(sig => {
      try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch {
        return false; // length mismatch — not a match, not an error
      }
    });
}

type ResendEvent = {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    subject?: string;
    bounce?: { message?: string; type?: string };
  };
};

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('POST /api/webhooks/resend: RESEND_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  const body = await req.text();

  if (!svixId || !svixTimestamp || !svixSignature || !verifySignature(body, { id: svixId, timestamp: svixTimestamp, signature: svixSignature }, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body) as ResendEvent;
  const emailId = event.data.email_id;
  if (!emailId) return NextResponse.json({ received: true });

  const db = getServerSupabase();

  const STATUS_BY_TYPE: Record<string, 'delivered' | 'delayed' | 'bounced' | 'complained' | 'suppressed' | 'failed'> = {
    'email.delivered':        'delivered',
    'email.delivery_delayed': 'delayed',
    'email.bounced':          'bounced',
    'email.complained':       'complained',
    // Resend refused to send: the address is on its suppression list (058).
    'email.suppressed':       'suppressed',
    'email.failed':           'failed',
  };
  const status = STATUS_BY_TYPE[event.type];
  if (!status) return NextResponse.json({ received: true }); // sent/opened/clicked — not tracked

  const bounceReason = event.data.bounce?.message ?? null;

  const { data: updated } = await db
    .from('email_deliveries')
    .update({ status, last_event_at: new Date().toISOString(), bounce_reason: bounceReason })
    .eq('id', emailId)
    .select('to_email, subject, purpose')
    .maybeSingle();

  const to = updated?.to_email ?? event.data.to?.[0] ?? 'unknown recipient';

  // One of the admin inboxes stopped receiving. The usual admin alert would
  // go to that same broken inbox too, so warn the OTHER admin addresses
  // directly, at most once per inbox per day.
  if ((status === 'bounced' || status === 'complained' || status === 'suppressed' || status === 'failed') && isAdminRecipient(to)) {
    const others = adminRecipients().filter(a => a !== to.trim().toLowerCase());
    const purpose = `admin_inbox_failing:${to.trim().toLowerCase()}:${new Date().toISOString().slice(0, 10)}`;
    const { count: already } = await db.from('email_deliveries').select('id', { count: 'exact', head: true }).eq('purpose', purpose);
    if (others.length && !already) {
      sendToAdmins({
        only: others,
        purpose,
        subject: `Admin inbox not receiving Ventry email: ${to}`,
        html: adminInboxFailingHtml(to, status, bounceReason),
      }).catch(err => console.error('resend webhook: admin-inbox warning failed', err));
    }
  }

  if (status === 'bounced' || status === 'complained' || status === 'suppressed') {
    const subject = updated?.subject ?? event.data.subject ?? '';
    notify(
      { type: 'admin' },
      {
        notifType: 'email_bounced',
        title: status === 'bounced' ? `Email bounced — ${to}` : status === 'suppressed' ? `Email suppressed — ${to}` : `Recipient marked email as spam — ${to}`,
        body: `"${subject}"${updated?.purpose ? ` (${updated.purpose})` : ''} ${status === 'bounced' ? 'bounced' : status === 'suppressed' ? 'was not sent: Resend has this address on its suppression list' : 'was reported as spam'} and will not be delivered. ${bounceReason ? `Reason: ${bounceReason}. ` : ''}Resend auto-suppresses this address until manually cleared in the Resend dashboard.`,
        link: `/admin/buyers?search=${encodeURIComponent(to)}`,
      },
      { emailChannel: 'immediate' },
    ).catch(err => console.error('resend webhook: notify error', err));
  }

  return NextResponse.json({ received: true });
}
