import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM    = process.env.RESEND_FROM_EMAIL!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function emailShell(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#ffffff; font-family:Arial,sans-serif; }
  .wrap { max-width:560px; margin:32px auto; padding:0 16px; }
  .card { background:#0f0e1a; border-radius:12px; padding:32px; color:#f1f0ff; }
  .label { color:#9ca3af; font-size:13px; }
  .mono { font-family:monospace; background:#1a1a2e; padding:3px 8px; border-radius:4px; }
  a.btn { display:inline-block; background:#7c3aed; color:#ffffff !important; text-decoration:none;
          padding:12px 28px; border-radius:8px; font-weight:700; font-size:14px; }
  .footer { color:#6b7280; font-size:11px; margin-top:24px; }
  @media (prefers-color-scheme:light){
    .card { background:#1a1630; }
  }
</style>
</head>
<body>
<div class="wrap"><div class="card">${content}</div></div>
</body>
</html>`;
}

export async function sendTicketEmail(params: {
  to: string;
  buyerName: string;
  tickets: Array<{ ticketId: string; refundCode: string }>;
  paystackRef: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  tierName: string;
  totalPaid: number;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

  const { tickets } = params;
  const count = tickets.length;

  const ticketBlocks = tickets.map(({ ticketId, refundCode }, i) => `
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#12121a;border:1px solid #2d2d3d;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:20px;">
        <p style="font-size:13px;font-weight:700;color:#a855f7;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">
          Ticket ${i + 1} of ${count} &mdash; ${params.tierName}
        </p>
        <div style="text-align:center;margin-bottom:16px;">
          <img src="${APP_URL}/api/tickets/${ticketId}/qr"
               alt="QR Code" width="180" height="180"
               style="border-radius:8px;display:block;margin:0 auto;border:4px solid #ffffff;" />
          <p style="color:#9ca3af;font-size:11px;margin:8px 0 0;">Present at the venue entrance</p>
        </div>
        <p style="margin:4px 0;color:#f1f0ff;font-size:13px;">
          <strong>Ticket&nbsp;ID:</strong> <span class="mono">${ticketId}</span>
        </p>
        <p style="margin:4px 0;color:#f1f0ff;font-size:13px;">
          <strong>Refund&nbsp;Code:</strong> <span class="mono">${refundCode}</span>
        </p>
        <a href="${APP_URL}/ticket/${ticketId}"
           style="display:inline-block;margin-top:12px;color:#a855f7;font-size:12px;text-decoration:underline;">
          View this ticket online
        </a>
      </td></tr>
    </table>
  `).join('');

  const viewAllBtn = count > 1
    ? `<a href="${APP_URL}/tickets?ref=${params.paystackRef}" class="btn" style="margin-bottom:16px;">
         View All ${count} Tickets Online
       </a><br/>`
    : `<a href="${APP_URL}/ticket/${tickets[0].ticketId}" class="btn" style="margin-bottom:16px;">
         View Ticket Online
       </a><br/>`;

  const subject = count === 1
    ? `Your ticket for ${params.eventName} — ${tickets[0].ticketId}`
    : `Your ${count} tickets for ${params.eventName}`;

  const html = emailShell(`
    <h1 style="color:#a855f7;font-size:22px;margin:0 0 6px;">
      ${count === 1 ? 'Your ticket is confirmed ✓' : `Your ${count} tickets are confirmed ✓`}
    </h1>
    <p class="label" style="margin:0 0 24px;">
      Hi ${params.buyerName || params.to}, here ${count === 1 ? 'is your ticket' : 'are your tickets'}.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#12121a;border:1px solid #2d2d3d;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <p style="font-size:17px;font-weight:700;margin:0 0 4px;color:#f1f0ff;">${esc(params.eventName)}</p>
        <p class="label" style="margin:0 0 12px;">${esc(params.eventDate)} &bull; ${esc(params.eventVenue)}</p>
        <p style="margin:4px 0;color:#f1f0ff;font-size:13px;">
          <strong>Ticket&nbsp;Type:</strong> ${params.tierName} &times; ${count}
        </p>
        <p style="margin:4px 0;color:#f1f0ff;font-size:13px;">
          <strong>Total&nbsp;Paid:</strong> ${params.totalPaid === 0 ? 'Free' : fmt(params.totalPaid)}
        </p>
      </td></tr>
    </table>

    ${ticketBlocks}

    ${viewAllBtn}

    <p class="footer">Your payment is held in escrow by Ventry and only released to the organizer after the event occurs.</p>
  `);

  await resend.emails.send({
    from: `Ventry <${FROM}>`,
    to: params.to,
    subject,
    html,
  });
}

export async function sendOTPEmail(to: string, name: string, otp: string) {
  await resend.emails.send({
    from: `Ventry <${FROM}>`,
    to,
    subject: `Your Ventry verification code: ${otp}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Verify your email</h1>
      <p style="color:#f1f0ff;margin:0 0 24px;">Hi ${esc(name)}, enter this code to activate your organizer account:</p>
      <div style="text-align:center;background:#12121a;border:1px solid #2d2d3d;border-radius:12px;padding:28px;margin-bottom:24px;">
        <span style="font-size:40px;font-weight:700;letter-spacing:0.25em;color:#a855f7;font-family:monospace;">${otp}</span>
      </div>
      <p style="color:#9ca3af;font-size:13px;margin:0;">Expires in <strong style="color:#f1f0ff;">10 minutes</strong>. If you didn't create a Ventry account, ignore this email.</p>
    `),
  });
}

export async function sendKYCApprovedEmail(to: string, name: string) {
  await resend.emails.send({
    from: `Ventry <${FROM}>`,
    to,
    subject: 'KYC Approved — You can now create events',
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">KYC Approved ✓</h1>
      <p style="color:#f1f0ff;">Hi ${esc(name)}, your identity verification has been approved. You can now create and publish events on Ventry.</p>
      <br/>
      <a href="${APP_URL}/organizer/events/create" class="btn">Create Your First Event</a>
    `),
  });
}

export async function sendKYCRejectedEmail(to: string, name: string, reason: string) {
  await resend.emails.send({
    from: `Ventry <${FROM}>`,
    to,
    subject: 'KYC Review Update',
    html: emailShell(`
      <h1 style="color:#f87171;font-size:22px;margin:0 0 12px;">KYC Review</h1>
      <p style="color:#f1f0ff;">Hi ${esc(name)}, unfortunately we could not verify your identity at this time.</p>
      <p style="color:#f1f0ff;"><strong>Reason:</strong> ${esc(reason)}</p>
      <p style="color:#9ca3af;font-size:13px;">Please resubmit with correct documents or contact support.</p>
    `),
  });
}

export async function sendEventApprovedEmail(to: string, organizerName: string, eventName: string, eventId: string) {
  await resend.emails.send({
    from: `Ventry <${FROM}>`,
    to,
    subject: `Your event "${eventName}" is now live`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Event Approved ✓</h1>
      <p style="color:#f1f0ff;">Hi ${esc(organizerName)}, great news! <strong>&ldquo;${esc(eventName)}&rdquo;</strong> has been approved and is now live on Ventry.</p>
      <br/>
      <a href="${APP_URL}/events/${eventId}" class="btn">View Your Event</a>
    `),
  });
}

export async function sendEventRejectedEmail(to: string, organizerName: string, eventName: string, reason: string) {
  await resend.emails.send({
    from: `Ventry <${FROM}>`,
    to,
    subject: `Event Review: ${eventName}`,
    html: emailShell(`
      <h1 style="color:#f87171;font-size:22px;margin:0 0 12px;">Event Review</h1>
      <p style="color:#f1f0ff;">Hi ${esc(organizerName)}, we could not approve <strong>&ldquo;${esc(eventName)}&rdquo;</strong> at this time.</p>
      <p style="color:#f1f0ff;"><strong>Reason:</strong> ${esc(reason)}</p>
      <p style="color:#9ca3af;font-size:13px;">You may edit and resubmit the event from your dashboard.</p>
    `),
  });
}

export async function sendRefundConfirmationEmail(to: string, ticketId: string, amount: number, eventName: string) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);
  await resend.emails.send({
    from: `Ventry <${FROM}>`,
    to,
    subject: `Refund processed for ${ticketId}`,
    html: emailShell(`
      <h1 style="color:#34d399;font-size:22px;margin:0 0 12px;">Refund Processed ✓</h1>
      <p style="color:#f1f0ff;">Your refund of <strong>${fmt(amount)}</strong> for <strong>${esc(eventName)}</strong> (${ticketId}) has been initiated.</p>
      <p style="color:#9ca3af;font-size:13px;">It will appear in your account within 3–5 business days.</p>
    `),
  });
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const resetUrl = `${APP_URL}/organizer/reset-password?token=${resetToken}`;
  await resend.emails.send({
    from: `Ventry <${FROM}>`,
    to,
    subject: 'Reset your Ventry password',
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Reset Your Password</h1>
      <p style="color:#f1f0ff;">Click below to reset your password. This link expires in 1 hour.</p>
      <br/>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <p class="footer">If you didn't request this, ignore this email — your password won't change.</p>
    `),
  });
}

export async function sendReminderEmail(params: {
  to: string;
  buyerName: string;
  ticketId: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  eventCity: string;
  reminderType: '1_week' | '1_day' | '3_hours';
}) {
  const labels = {
    '1_week':   { subject: `Reminder: "${params.eventName}" is in 1 week`, heading: 'Your event is 1 week away', badge: '1 WEEK TO GO' },
    '1_day':    { subject: `Reminder: "${params.eventName}" is tomorrow`, heading: "Your event is tomorrow", badge: 'TOMORROW' },
    '3_hours':  { subject: `Reminder: "${params.eventName}" is today`, heading: 'Your event is today', badge: 'TODAY' },
  };

  const { subject, heading, badge } = labels[params.reminderType];

  const html = emailShell(`
    <p style="display:inline-block;background:#7c3aed;color:#fff;font-size:11px;font-weight:700;
       letter-spacing:0.08em;padding:3px 10px;border-radius:20px;margin:0 0 16px;">${badge}</p>
    <h1 style="color:#a855f7;font-size:22px;margin:0 0 6px;">${heading}</h1>
    <p class="label" style="margin:0 0 24px;">Hi ${esc(params.buyerName || params.to)}, don't forget — your event is coming up soon.</p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#12121a;border:1px solid #2d2d3d;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <p style="font-size:17px;font-weight:700;margin:0 0 8px;color:#f1f0ff;">${esc(params.eventName)}</p>
        <p style="margin:4px 0;color:#9ca3af;font-size:13px;">
          <strong style="color:#f1f0ff;">Date:</strong> ${esc(params.eventDate)}
        </p>
        <p style="margin:4px 0;color:#9ca3af;font-size:13px;">
          <strong style="color:#f1f0ff;">Time:</strong> ${esc(params.eventTime)}
        </p>
        <p style="margin:4px 0;color:#9ca3af;font-size:13px;">
          <strong style="color:#f1f0ff;">Venue:</strong> ${esc(params.eventVenue)}, ${esc(params.eventCity)}
        </p>
      </td></tr>
    </table>

    <a href="${APP_URL}/ticket/${params.ticketId}" class="btn" style="margin-bottom:16px;">View My Ticket</a>
    <br/>
    <p class="footer">You received this reminder because you purchased a ticket on Ventry.</p>
  `);

  await resend.emails.send({
    from: `Ventry <${FROM}>`,
    to: params.to,
    subject,
    html,
  });
}
