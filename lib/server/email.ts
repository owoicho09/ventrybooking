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

const SUPPORT_EMAIL = 'support@ventrybooking.com';

// Single choke point for every outbound email. The sending address never
// changes (Ventry's own verified domain) — only the display name varies, so
// a ticket/reminder/location-change email reads as coming from the event,
// a teaser reads as coming from the organiser, and everything else (refund,
// OTP, payouts, etc.) reads as coming from Ventry. reply-to always routes to
// support so organisers never receive buyer replies (e.g. to a refund email)
// directly.
async function sendEmail(opts: { to: string; subject: string; html: string; fromName?: string; replyTo?: string }) {
  const { error } = await resend.emails.send({
    from: `${opts.fromName ?? 'Ventry'} <${FROM}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo ?? SUPPORT_EMAIL,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendTicketEmail(params: {
  to: string;
  buyerName: string;
  tickets: Array<{ ticketId: string; refundCode: string }>;
  paystackRef: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  eventMode?: 'physical' | 'online';
  tierName: string;
  subtotal?: number;
  serviceFee?: number;
  processingFee?: number;
  totalPaid: number;
  bannerUrl?: string | null;
}) {
  const isOnline = params.eventMode === 'online';
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
          <p style="color:#9ca3af;font-size:11px;margin:8px 0 0;">${isOnline ? 'Your join link will be emailed to you before the event' : 'Present at the venue entrance'}</p>
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

  // Fixed banner height with object-fit:cover keeps varied upload aspect
  // ratios looking uniform in modern mail clients (Gmail, Apple Mail,
  // mobile). Clients that ignore object-fit (older Outlook) still get a
  // clean, undistorted image scaled to the container width.
  const bannerBlock = params.bannerUrl
    ? `<div style="margin:0 0 20px;border-radius:8px;overflow:hidden;line-height:0;">
         <img src="${esc(params.bannerUrl)}" alt="${esc(params.eventName)}" width="496"
              style="display:block;width:100%;max-width:496px;height:180px;object-fit:cover;background:#1a1a2e;" />
       </div>`
    : '';

  const html = emailShell(`
    ${bannerBlock}
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
        <p class="label" style="margin:0 0 12px;">${esc(params.eventDate)}${isOnline ? ' &bull; Online Event' : ` &bull; ${esc(params.eventVenue)}`}</p>
        ${isOnline ? `<p style="margin:0 0 12px;color:#9ca3af;font-size:12px;">Your Zoom link will be emailed to you before the event, along with your reminders.</p>` : ''}
        <p style="margin:4px 0;color:#f1f0ff;font-size:13px;">
          <strong>Ticket&nbsp;Type:</strong> ${params.tierName} &times; ${count}
        </p>
        ${params.totalPaid > 0 && params.subtotal != null && params.serviceFee != null && params.processingFee != null
          ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px;">
               <tr><td style="color:#9ca3af;font-size:12px;padding:2px 0;">Subtotal</td><td align="right" style="color:#f1f0ff;font-size:12px;padding:2px 0;">${fmt(params.subtotal)}</td></tr>
               <tr><td style="color:#9ca3af;font-size:12px;padding:2px 0;">Ventry service fee</td><td align="right" style="color:#f1f0ff;font-size:12px;padding:2px 0;">${fmt(params.serviceFee)}</td></tr>
               <tr><td style="color:#9ca3af;font-size:12px;padding:2px 0;">Processing fee</td><td align="right" style="color:#f1f0ff;font-size:12px;padding:2px 0;">${fmt(params.processingFee)}</td></tr>
               <tr><td style="color:#f1f0ff;font-size:13px;font-weight:700;padding:6px 0 0;border-top:1px solid #2d2d3d;">Total Paid</td><td align="right" style="color:#f1f0ff;font-size:13px;font-weight:700;padding:6px 0 0;border-top:1px solid #2d2d3d;">${fmt(params.totalPaid)}</td></tr>
             </table>`
          : `<p style="margin:4px 0;color:#f1f0ff;font-size:13px;"><strong>Total&nbsp;Paid:</strong> ${params.totalPaid === 0 ? 'Free' : fmt(params.totalPaid)}</p>`}
      </td></tr>
    </table>

    ${ticketBlocks}

    ${viewAllBtn}

    <p class="footer">Your payment is held in escrow by Ventry and only released to the organizer after the event occurs.</p>
  `);

  await sendEmail({ to: params.to, subject, html, fromName: params.eventName });
}

export async function sendOTPEmail(to: string, name: string, otp: string) {
  await sendEmail({
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

export async function sendTicketLookupOTPEmail(to: string, otp: string) {
  await sendEmail({
    to,
    subject: `Your Ventry ticket lookup code: ${otp}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Confirm it's you</h1>
      <p style="color:#f1f0ff;margin:0 0 24px;">Someone requested to view the tickets tied to this email address on Ventry. Enter this code to continue:</p>
      <div style="text-align:center;background:#12121a;border:1px solid #2d2d3d;border-radius:12px;padding:28px;margin-bottom:24px;">
        <span style="font-size:40px;font-weight:700;letter-spacing:0.3em;color:#a855f7;font-family:monospace;">${otp}</span>
      </div>
      <p style="color:#9ca3af;font-size:13px;margin:0;">Expires in <strong style="color:#f1f0ff;">10 minutes</strong>. If this wasn't you, ignore this email — your tickets are safe and no one can view them without this code.</p>
    `),
  });
}

export async function sendKYCApprovedEmail(to: string, name: string) {
  await sendEmail({
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
  await sendEmail({
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

export async function sendEventApprovedEmail(to: string, organizerName: string, eventName: string, eventSlug: string) {
  await sendEmail({
    to,
    subject: `Your event "${eventName}" is now live`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Event Approved ✓</h1>
      <p style="color:#f1f0ff;">Hi ${esc(organizerName)}, great news! <strong>&ldquo;${esc(eventName)}&rdquo;</strong> has been approved and is now live on Ventry.</p>
      <br/>
      <a href="${APP_URL}/${eventSlug}" class="btn">View Your Event</a>
    `),
  });
}

export async function sendEventRejectedEmail(to: string, organizerName: string, eventName: string, reason: string) {
  await sendEmail({
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

export async function sendLocationUpdatedEmail(params: {
  to: string;
  buyerName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  address: string;
  city: string;
  landmark?: string;
  eventUrl: string;
}) {
  const locationLines = [
    params.venue,
    params.address,
    params.landmark ? `Landmark: ${params.landmark}` : '',
    params.city,
  ].filter(Boolean);

  await sendEmail({
    to: params.to,
    fromName: params.eventName,
    subject: `Location update for ${params.eventName}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Event Location Updated</h1>
      <p style="color:#f1f0ff;">Hi ${esc(params.buyerName || params.to)}, the organizer updated the location details for <strong>${esc(params.eventName)}</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#12121a;border:1px solid #2d2d3d;border-radius:8px;margin:20px 0 24px;">
        <tr><td style="padding:20px;">
          <p style="margin:4px 0;color:#9ca3af;font-size:13px;">
            <strong style="color:#f1f0ff;">Date:</strong> ${esc(params.eventDate)}
          </p>
          <p style="margin:4px 0;color:#9ca3af;font-size:13px;">
            <strong style="color:#f1f0ff;">Time:</strong> ${esc(params.eventTime)}
          </p>
          <p style="margin:12px 0 4px;color:#f1f0ff;font-size:13px;"><strong>Exact location:</strong></p>
          ${locationLines.map(line => `<p style="margin:4px 0;color:#9ca3af;font-size:13px;">${esc(line)}</p>`).join('')}
        </td></tr>
      </table>
      <a href="${params.eventUrl}" class="btn">View Event Page</a>
      <p class="footer">You received this because you purchased a ticket for this event.</p>
    `),
  });
}

export async function sendMeetingLinkUpdatedEmail(params: {
  to: string;
  buyerName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  meetingLink: string;
  meetingPasscode?: string;
}) {
  await sendEmail({
    to: params.to,
    fromName: params.eventName,
    subject: `Updated meeting link for ${params.eventName}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Meeting Link Updated</h1>
      <p style="color:#f1f0ff;">Hi ${esc(params.buyerName || params.to)}, the organizer updated the meeting link for <strong>${esc(params.eventName)}</strong>. Use the new link below to join.</p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#12121a;border:1px solid #2d2d3d;border-radius:8px;margin:20px 0 24px;">
        <tr><td style="padding:20px;">
          <p style="margin:4px 0;color:#9ca3af;font-size:13px;">
            <strong style="color:#f1f0ff;">Date:</strong> ${esc(params.eventDate)}
          </p>
          <p style="margin:4px 0;color:#9ca3af;font-size:13px;">
            <strong style="color:#f1f0ff;">Time:</strong> ${esc(params.eventTime)}
          </p>
          <p style="margin:12px 0 4px;color:#f1f0ff;font-size:13px;"><strong>New meeting link:</strong></p>
          <p style="margin:4px 0;color:#9ca3af;font-size:13px;word-break:break-all;">${esc(params.meetingLink)}</p>
          ${params.meetingPasscode ? `<p style="margin:4px 0;color:#9ca3af;font-size:13px;"><strong style="color:#f1f0ff;">Passcode:</strong> ${esc(params.meetingPasscode)}</p>` : ''}
        </td></tr>
      </table>
      <p class="footer">This link is personal to your ticket — please don't share it. You received this because you purchased a ticket for this event.</p>
    `),
  });
}

// Explicitly always 'Ventry' — refunds are a platform action, and organisers
// must never receive a buyer's refund correspondence.
export async function sendRefundConfirmationEmail(to: string, ticketId: string, amount: number, eventName: string) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);
  await sendEmail({
    to,
    subject: `Refund processed for ${ticketId}`,
    html: emailShell(`
      <h1 style="color:#34d399;font-size:22px;margin:0 0 12px;">Refund Processed ✓</h1>
      <p style="color:#f1f0ff;">Your refund of <strong>${fmt(amount)}</strong> for <strong>${esc(eventName)}</strong> (${ticketId}) has been initiated.</p>
      <p style="color:#9ca3af;font-size:13px;">It will appear in your account within 3–5 business days.</p>
    `),
  });
}

export async function sendPayoutReleasedEmail(params: {
  to: string;
  organizerName: string;
  eventName: string;
  gross: number;
  fee: number;
  net: number;
  bankName: string;
  accountNumber: string;
  reference: string;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);
  const maskedAccount = params.accountNumber ? `****${params.accountNumber.slice(-4)}` : '';
  // Computed from the actual fee/gross rather than hardcoded, so historical payouts
  // made under a since-changed platform fee rate still display their true percentage.
  const feePercent = params.gross > 0 ? +((params.fee / params.gross) * 100).toFixed(1) : 0;

  await sendEmail({
    to: params.to,
    subject: `Payout released — ${params.eventName}`,
    html: emailShell(`
      <h1 style="color:#34d399;font-size:22px;margin:0 0 6px;">Payout Released ✓</h1>
      <p class="label" style="margin:0 0 24px;">Hi ${esc(params.organizerName)}, your payout for <strong style="color:#f1f0ff;">${esc(params.eventName)}</strong> has been sent.</p>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#12121a;border:1px solid #2d2d3d;border-radius:8px;margin-bottom:24px;">
        <tr><td style="padding:20px;">
          <p style="margin:4px 0;color:#9ca3af;font-size:13px;"><strong style="color:#f1f0ff;">Ticket Revenue:</strong> ${fmt(params.gross)}</p>
          <p style="margin:4px 0;color:#9ca3af;font-size:13px;"><strong style="color:#f1f0ff;">Platform fee (${feePercent}%):</strong> ${fmt(params.fee)}</p>
          <p style="margin:8px 0 4px;color:#34d399;font-size:17px;font-weight:700;">Amount Paid: ${fmt(params.net)}</p>
          <p style="margin:12px 0 4px;color:#9ca3af;font-size:13px;"><strong style="color:#f1f0ff;">Sent to:</strong> ${esc(params.bankName)} ${maskedAccount}</p>
          <p style="margin:4px 0;color:#9ca3af;font-size:13px;"><strong style="color:#f1f0ff;">Reference:</strong> <span class="mono">${esc(params.reference)}</span></p>
        </td></tr>
      </table>

      <a href="${APP_URL}/organizer/payouts" class="btn">View Payout History</a>
      <p class="footer">If tickets for this event are still on sale, any additional revenue will be paid out separately.</p>
    `),
  });
}

export async function sendMissingBankDetailsEmail(to: string, organizerName: string, eventName: string) {
  await sendEmail({
    to,
    subject: `Action needed: add your bank details to receive payout for "${eventName}"`,
    html: emailShell(`
      <h1 style="color:#f59e0b;font-size:22px;margin:0 0 12px;">Bank Details Required</h1>
      <p style="color:#f1f0ff;">Hi ${esc(organizerName)}, we tried to release your payout for <strong>&ldquo;${esc(eventName)}&rdquo;</strong> but couldn't find your bank account details on file.</p>
      <p style="color:#9ca3af;font-size:13px;">Add your bank name, account number, and account name in your Ventry settings so we can send your funds.</p>
      <br/>
      <a href="${APP_URL}/organizer/settings" class="btn">Add Bank Details</a>
    `),
  });
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const resetUrl = `${APP_URL}/organizer/reset-password?token=${resetToken}`;
  await sendEmail({
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
  eventMode?: 'physical' | 'online';
  eventVenue: string;
  eventCity: string;
  meetingLink?: string | null;
  meetingPasscode?: string | null;
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
        ${params.eventMode === 'online' ? `
        <p style="margin:12px 0 4px;color:#f1f0ff;font-size:13px;"><strong>Meeting Link:</strong></p>
        <p style="margin:4px 0;color:#a855f7;font-size:13px;word-break:break-all;">
          <a href="${esc(params.meetingLink || '')}" style="color:#a855f7;">${esc(params.meetingLink || 'Link not available — contact the organizer')}</a>
        </p>
        ${params.meetingPasscode ? `<p style="margin:4px 0;color:#9ca3af;font-size:13px;"><strong style="color:#f1f0ff;">Passcode:</strong> ${esc(params.meetingPasscode)}</p>` : ''}
        ` : `
        <p style="margin:4px 0;color:#9ca3af;font-size:13px;">
          <strong style="color:#f1f0ff;">Venue:</strong> ${esc(params.eventVenue)}, ${esc(params.eventCity)}
        </p>
        `}
      </td></tr>
    </table>

    ${params.eventMode === 'online' ? `<p class="footer" style="margin:0 0 16px;">This link is personal to your ticket — please don't share it.</p>` : ''}
    <a href="${APP_URL}/ticket/${params.ticketId}" class="btn" style="margin-bottom:16px;">View My Ticket</a>
    <br/>
    <p class="footer">You received this reminder because you purchased a ticket on Ventry.</p>
  `);

  await sendEmail({ to: params.to, subject, html, fromName: params.eventName });
}

export async function sendNewEventTeaserEmail(params: {
  to: string;
  organizerName: string;
  organizerHandle: string;
  eventName: string;
  eventDate: string;
  eventUrl: string;
  unsubscribeUrl: string;
}) {
  const html = emailShell(`
    <h1 style="color:#a855f7;font-size:22px;margin:0 0 6px;">${esc(params.organizerName)} just announced a new event</h1>
    <p class="label" style="margin:0 0 24px;">You're getting this because you asked to be notified about their next event.</p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#12121a;border:1px solid #2d2d3d;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <p style="font-size:17px;font-weight:700;margin:0 0 4px;color:#f1f0ff;">${esc(params.eventName)}</p>
        <p class="label" style="margin:0;">${esc(params.eventDate)}</p>
      </td></tr>
    </table>

    <a href="${params.eventUrl}" class="btn">View Event &amp; Get Tickets</a>
    <p class="footer">
      Sent because you subscribed to updates from ${esc(params.organizerName)} on Ventry.
      <a href="${params.unsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a>
    </p>
  `);

  await sendEmail({
    to: params.to,
    subject: `${params.organizerName} just announced: ${params.eventName}`,
    html,
    fromName: params.organizerName,
  });
}
