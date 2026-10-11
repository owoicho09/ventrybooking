import { sendEmail, emailShell, esc } from '@/lib/server/email';
import { formatNGN } from '@/lib/utils';

// Emails for refund cases and the claim list (Refund Policy v3 §6–§9).
// Ventry runs the process; the organiser pays. Every buyer-facing email says
// so plainly rather than implying Ventry will pay.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ventrybooking.com';
const SUPPORT = 'support@ventrybooking.com';

export const claimUrl = (ticketId?: string, refundCode?: string) =>
  `${APP_URL}/refunds/claim${ticketId ? `?ticket=${encodeURIComponent(ticketId)}${refundCode ? `&code=${encodeURIComponent(refundCode)}` : ''}` : ''}`;

export const fmtDay = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });

export interface ClaimRow { ticketId: string; refundCode: string; amount: number }

const box = (inner: string) =>
  `<table width="100%" cellpadding="0" cellspacing="0" style="background:#12121a;border:1px solid #2d2d3d;border-radius:8px;margin:20px 0;"><tr><td style="padding:18px 20px;">${inner}</td></tr></table>`;
const p = (html: string, muted = false) =>
  `<p style="margin:0 0 12px;color:${muted ? '#9ca3af' : '#f1f0ff'};font-size:${muted ? 13 : 14}px;line-height:1.55;">${html}</p>`;

function ticketRows(rows: ClaimRow[]) {
  return rows.map(r => `
    <p style="margin:6px 0;color:#9ca3af;font-size:13px;">
      Ticket ID <span class="mono">${esc(r.ticketId)}</span> &nbsp; Refund ID <span class="mono">${esc(r.refundCode)}</span>
      &nbsp; <strong style="color:#f1f0ff;">${formatNGN(r.amount)}</strong>
    </p>`).join('');
}

const NOTICE_LABEL = ['', '', '15 days left to claim', '5 days left to claim', 'Last day to claim'];

/** Day 0/15/25/30 notice for a cancelled event (settled tickets — the organiser refunds). */
export async function sendCancellationClaimNotice(params: {
  to: string; buyerName: string; eventName: string; rows: ClaimRow[];
  closesAt: string; noticeNo: number; cancelDays: number; organiserName: string; organiserEmail?: string | null; purpose: string;
}) {
  const first = params.noticeNo <= 1;
  const link = claimUrl(params.rows[0].ticketId, params.rows[0].refundCode);
  await sendEmail({
    to: params.to,
    purpose: params.purpose,
    subject: first ? `${params.eventName} has been cancelled: how to claim your refund` : `${NOTICE_LABEL[params.noticeNo]}: refund for ${params.eventName}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">${first ? 'This event has been cancelled' : esc(NOTICE_LABEL[params.noticeNo])}</h1>
      ${p(`Hi ${esc(params.buyerName || 'there')}, <strong>${esc(params.eventName)}</strong> has been cancelled. You can claim a refund of the ticket price until <strong>${fmtDay(params.closesAt)}</strong>.`)}
      ${box(`${p('<strong>You will need these to claim:</strong>')}${ticketRows(params.rows)}`)}
      <a href="${link}" class="btn">Claim your refund</a>
      ${p('', true)}
      ${p(`How it works: when the 30 days end, Ventry sends ${esc(params.organiserName)} one list of everyone who claimed, with the bank details you give us. They pay you directly within <strong>${params.cancelDays} days</strong> of receiving the list. Ventry does not hold or pay this money.`, true)}
      ${p('The service fee and processing fee are not refundable. A claim made after the window closes is not paid.', true)}
      ${params.organiserEmail ? p(`Refund questions for the organiser: ${esc(params.organiserEmail)}`, true) : ''}
      <p class="footer">Claim only through the link above. Ventry will never ask for your card details, PIN or banking password.</p>
    `),
  });
}

/** A cancelled event where Ventry still held the money and refunded it itself (Refund Policy §2.2). */
export async function sendAutoRefundNotice(params: {
  to: string; buyerName: string; eventName: string; amount: number; failed: boolean; purpose: string;
}) {
  const free = params.amount <= 0;
  await sendEmail({
    to: params.to,
    purpose: params.purpose,
    subject: `${params.eventName} has been cancelled`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">This event has been cancelled</h1>
      ${p(`Hi ${esc(params.buyerName || 'there')}, <strong>${esc(params.eventName)}</strong> has been cancelled.`)}
      ${free
        ? p('Your ticket was free, so there is nothing to refund. You don&rsquo;t need to do anything.')
        : params.failed
          ? p(`Ventry was still holding the money for your ticket, so we are refunding <strong>${formatNGN(params.amount)}</strong> to the card or account you paid with. It hasn&rsquo;t gone through yet; we&rsquo;re on it. You don&rsquo;t need to claim.`)
          : p(`Ventry was still holding the money for your ticket, so we have refunded <strong>${formatNGN(params.amount)}</strong> to the card or account you paid with. It usually arrives within 5 to 10 working days, depending on your bank. You don&rsquo;t need to claim.`)}
      ${free ? '' : p('The service fee and processing fee are not refundable.', true)}
      <p class="footer">Questions? Reply to this email or write to ${SUPPORT}.</p>
    `),
  });
}

/** Postponement or venue change where the organiser's published policy allows a refund. */
export async function sendChangeClaimNotice(params: {
  to: string; buyerName: string; eventName: string; kind: 'postponement' | 'venue_change';
  changeLines: string[]; refundAll: boolean; rows: ClaimRow[]; closesAt: string; noticeNo: number;
  cancelDays: number; organiserName: string; organiserEmail?: string | null; eventUrl: string; purpose: string;
}) {
  const first = params.noticeNo <= 1;
  const what = params.kind === 'postponement' ? 'has been postponed' : 'has moved to a new venue';
  const link = claimUrl(params.rows[0].ticketId, params.rows[0].refundCode);
  await sendEmail({
    to: params.to,
    purpose: params.purpose,
    subject: first ? `${params.eventName} ${what}` : `${NOTICE_LABEL[params.noticeNo]}: refund option for ${params.eventName}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">${first ? `The event ${what}` : esc(NOTICE_LABEL[params.noticeNo])}</h1>
      ${p(`Hi ${esc(params.buyerName || 'there')}, <strong>${esc(params.eventName)}</strong> ${what}.`)}
      ${box(params.changeLines.map(l => `<p style="margin:4px 0;color:#f1f0ff;font-size:13px;">${esc(l)}</p>`).join(''))}
      ${p(`<strong>Your ticket is still valid</strong> for the new details. You don&rsquo;t need to do anything to keep it.`)}
      ${p(`${params.refundAll ? 'The organiser has said every buyer can be refunded.' : 'The organiser&rsquo;s published policy lets you ask for a refund instead.'} If you&rsquo;d rather have your money back, claim by <strong>${fmtDay(params.closesAt)}</strong>. Claiming cancels your ticket.`)}
      ${box(ticketRows(params.rows))}
      <a href="${link}" class="btn">Claim a refund instead</a>
      ${p('', true)}
      ${p(`When the claim window ends, Ventry sends ${esc(params.organiserName)} one list of everyone who claimed. They pay you directly within ${params.cancelDays} days of receiving it. The service fee and processing fee are not refundable.`, true)}
      ${params.organiserEmail ? p(`Refund questions for the organiser: ${esc(params.organiserEmail)}`, true) : ''}
      <p style="margin-top:8px;"><a href="${params.eventUrl}" style="color:#a855f7;font-size:13px;">View the event page</a></p>
    `),
  });
}

/** Postponement, venue change or new start time with no refund under the organiser's published policy. */
export async function sendChangeNotice(params: {
  to: string; buyerName: string; eventName: string; kind: 'postponement' | 'venue_change' | 'time_change';
  changeLines: string[]; eventUrl: string; purpose: string;
}) {
  const what = params.kind === 'postponement' ? 'has been postponed' : params.kind === 'venue_change' ? 'has moved to a new venue' : 'has a new start time';
  await sendEmail({
    to: params.to,
    purpose: params.purpose,
    subject: `${params.eventName} ${what}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">The event ${what}</h1>
      ${p(`Hi ${esc(params.buyerName || 'there')}, <strong>${esc(params.eventName)}</strong> ${what}.`)}
      ${box(params.changeLines.map(l => `<p style="margin:4px 0;color:#f1f0ff;font-size:13px;">${esc(l)}</p>`).join(''))}
      ${p('<strong>Your ticket is still valid</strong> for the new details. Bring the same QR ticket.')}
      ${params.kind === 'time_change'
        ? p('A new start time on the same day is not a postponement, so it doesn&rsquo;t open a refund (Refund Policy §8.5).', true)
        : p('The organiser&rsquo;s published refund policy, shown on the event page before you bought, does not offer a refund for this change.', true)}
      <a href="${params.eventUrl}#refund-policy" class="btn">View the event page</a>
      <p class="footer">Questions? Reply to this email or write to ${SUPPORT}.</p>
    `),
  });
}

export async function sendClaimCodeEmail(to: string, eventName: string, code: string) {
  await sendEmail({
    to,
    purpose: 'refund_claim_otp',
    subject: `Your code to claim a refund: ${code}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Confirm your refund claim</h1>
      ${p(`Enter this code to claim your refund for <strong>${esc(eventName)}</strong>:`)}
      <div style="text-align:center;background:#12121a;border:1px solid #2d2d3d;border-radius:12px;padding:24px;margin:16px 0 20px;">
        <span style="font-size:36px;font-weight:700;letter-spacing:0.25em;color:#a855f7;font-family:monospace;">${code}</span>
      </div>
      ${p('Expires in 15 minutes. If you didn&rsquo;t ask for this, someone may have your ticket details. Don&rsquo;t share the code.', true)}
    `),
  });
}

export async function sendClaimReceivedEmail(params: {
  to: string; buyerName: string; eventName: string; ticketId: string; refundCode: string; amount: number;
  accountLine: string; listBy: string | null; noShow: boolean; purpose: string;
}) {
  await sendEmail({
    to: params.to,
    purpose: params.purpose,
    subject: `Refund claim received: ${params.eventName}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">We&rsquo;ve recorded your claim</h1>
      ${p(`Hi ${esc(params.buyerName || 'there')}, your refund claim for <strong>${esc(params.eventName)}</strong> was received ${esc(new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }))}.`)}
      ${box(`<p style="margin:4px 0;color:#9ca3af;font-size:13px;">Ticket ID <span class="mono">${esc(params.ticketId)}</span> · Refund ID <span class="mono">${esc(params.refundCode)}</span></p>
        <p style="margin:4px 0;color:#9ca3af;font-size:13px;">Amount: <strong style="color:#f1f0ff;">${formatNGN(params.amount)}</strong></p>
        <p style="margin:4px 0;color:#9ca3af;font-size:13px;">Paid to: ${esc(params.accountLine)}</p>`)}
      ${params.noShow
        ? p('Ventry is checking what happened with the organiser and, where needed, the venue. We&rsquo;ll email you the outcome. If the claim is upheld, the organiser pays you directly.', true)
        : p(`The claim window closes ${params.listBy ? `on <strong>${fmtDay(params.listBy)}</strong>` : 'soon'}. We then send the organiser the full claim list and tell you the date they must pay by. The organiser pays you directly.`, true)}
      <p class="footer">Keep this email. If you&rsquo;re not paid by the deadline we give you, write to ${SUPPORT} with your ticket ID and refund ID.</p>
    `),
  });
}

/** The single claim list, sent to the organiser when the window closes (Refund Policy §6.5). */
export async function sendClaimListEmail(params: {
  to: string; organiserName: string; eventName: string; kindLabel: string;
  claims: { buyerName: string; ticketId: string; refundCode: string; amount: number; bankName: string; accountNumber: string; accountName: string }[];
  ventryRefunded: { ticketId: string; amount: number }[];
  payBy: string; total: number; dashboardUrl: string; purpose: string;
}) {
  const rows = params.claims.map(c => `
    <tr>
      <td style="padding:6px 8px;border-top:1px solid #2d2d3d;color:#f1f0ff;font-size:12px;">${esc(c.buyerName || '—')}<br><span style="color:#9ca3af;">${esc(c.ticketId)} · ${esc(c.refundCode)}</span></td>
      <td style="padding:6px 8px;border-top:1px solid #2d2d3d;color:#f1f0ff;font-size:12px;">${esc(c.accountName)}<br><span style="color:#9ca3af;">${esc(c.bankName)} ${esc(c.accountNumber)}</span></td>
      <td style="padding:6px 8px;border-top:1px solid #2d2d3d;color:#f1f0ff;font-size:12px;text-align:right;white-space:nowrap;">${formatNGN(c.amount)}</td>
    </tr>`).join('');
  await sendEmail({
    to: params.to,
    purpose: params.purpose,
    subject: `Refund claim list for ${params.eventName}: pay by ${fmtDay(params.payBy)}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Your refund claim list</h1>
      ${p(`Hi ${esc(params.organiserName)}, the claim window for <strong>${esc(params.eventName)}</strong> (${esc(params.kindLabel)}) has closed. This is the complete list. <strong>${params.claims.length}</strong> buyer${params.claims.length === 1 ? '' : 's'} claimed, <strong>${formatNGN(params.total)}</strong> in total.`)}
      ${p(`Pay each buyer the amount shown, to the account shown, by <strong>${fmtDay(params.payBy)}</strong>, the deadline you published. Then report it on your Refunds page with proof of payment.`)}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#12121a;border:1px solid #2d2d3d;border-radius:8px;margin:16px 0;border-collapse:collapse;">
        <tr><th align="left" style="padding:8px;color:#9ca3af;font-size:11px;">Buyer</th><th align="left" style="padding:8px;color:#9ca3af;font-size:11px;">Pay to</th><th align="right" style="padding:8px;color:#9ca3af;font-size:11px;">Amount</th></tr>
        ${rows}
      </table>
      ${params.ventryRefunded.length ? p(`Already refunded by Ventry from money it still held, so <strong>do not pay these again</strong>: ${params.ventryRefunded.map(r => `${esc(r.ticketId)} (${formatNGN(r.amount)})`).join(', ')}.`, true) : ''}
      <a href="${params.dashboardUrl}" class="btn">Open your Refunds page</a>
      ${p('', true)}
      ${p('Organisers who don&rsquo;t pay valid claims lose their verification badge, can have settlement held on their other events, and can be suspended or removed (Organiser Terms §11). Keep these bank details private and use them only to pay these refunds.', true)}
    `),
  });
}

export async function sendClaimListSentEmail(params: { to: string; buyerName: string; eventName: string; payBy: string; organiserEmail?: string | null; purpose: string }) {
  await sendEmail({
    to: params.to,
    purpose: params.purpose,
    subject: `Your refund for ${params.eventName}: the organiser must pay by ${fmtDay(params.payBy)}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Your claim is with the organiser</h1>
      ${p(`Hi ${esc(params.buyerName || 'there')}, the claim window for <strong>${esc(params.eventName)}</strong> has closed and Ventry has sent the organiser the full claim list, including your claim.`)}
      ${p(`They must pay you by <strong>${fmtDay(params.payBy)}</strong>. We&rsquo;ll email you when they report it paid.`)}
      ${params.organiserEmail ? p(`Organiser refund contact: ${esc(params.organiserEmail)}`, true) : ''}
      <p class="footer">Not paid by then? Write to ${SUPPORT} with the event name, your ticket ID and refund ID.</p>
    `),
  });
}

export async function sendRefundReportedPaidEmail(params: { to: string; buyerName: string; eventName: string; amount: number; purpose: string }) {
  await sendEmail({
    to: params.to,
    purpose: params.purpose,
    subject: `The organiser reports your refund for ${params.eventName} as paid`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Refund reported paid</h1>
      ${p(`Hi ${esc(params.buyerName || 'there')}, the organiser of <strong>${esc(params.eventName)}</strong> has told Ventry they paid your refund of <strong>${formatNGN(params.amount)}</strong>, and sent us proof of payment.`)}
      ${p('Transfers can take a little time to show. If it hasn&rsquo;t reached your account within 5 working days, let us know and we&rsquo;ll take it up with them.', true)}
      <p class="footer">Write to ${SUPPORT} with your ticket ID and refund ID.</p>
    `),
  });
}

export async function sendNoShowOutcomeEmail(params: { to: string; buyerName: string; eventName: string; upheld: boolean; note?: string | null; payBy?: string | null; purpose: string }) {
  await sendEmail({
    to: params.to,
    purpose: params.purpose,
    subject: `Your refund claim for ${params.eventName}: ${params.upheld ? 'upheld' : 'not upheld'}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">${params.upheld ? 'Your claim was upheld' : 'Your claim was not upheld'}</h1>
      ${params.upheld
        ? p(`Hi ${esc(params.buyerName || 'there')}, Ventry checked your claim for <strong>${esc(params.eventName)}</strong> and upheld it. The organiser has the claim list and must pay you by <strong>${fmtDay(params.payBy!)}</strong>.`)
        : p(`Hi ${esc(params.buyerName || 'there')}, Ventry checked your claim for <strong>${esc(params.eventName)}</strong> with the organiser and the venue, and couldn&rsquo;t uphold it.`)}
      ${params.note ? p(esc(params.note), true) : ''}
      <p class="footer">Questions? Reply to this email or write to ${SUPPORT}.</p>
    `),
  });
}

/** To the organiser when a refund case opens on their event. */
export async function sendOrganiserCaseOpenedEmail(params: {
  to: string; organiserName: string; eventName: string; kind: 'cancellation' | 'postponement' | 'venue_change' | 'no_show';
  closesAt: string; cancelDays: number; heldRefunded?: number; dashboardUrl: string;
}) {
  const intro: Record<typeof params.kind, string> = {
    cancellation: 'has been cancelled. Buyers have been emailed and can claim a refund',
    postponement: 'was postponed. Under your published policy buyers can claim a refund instead of keeping their ticket',
    venue_change: 'moved venue. Under your published policy buyers can claim a refund instead of keeping their ticket',
    no_show: 'has refund claims because a billed act did not appear. Ventry is verifying them with you and, where needed, the venue. Claims are open',
  };
  await sendEmail({
    to: params.to,
    purpose: `refund_case_opened:${params.kind}`,
    subject: `Refund claims are open for ${params.eventName}`,
    html: emailShell(`
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 12px;">Refund claims are open</h1>
      ${p(`Hi ${esc(params.organiserName)}, <strong>${esc(params.eventName)}</strong> ${intro[params.kind]} until <strong>${fmtDay(params.closesAt)}</strong>.`)}
      ${params.heldRefunded ? p(`Ventry was still holding ${formatNGN(params.heldRefunded)} for this event and has refunded those buyers directly. They are marked on your list so you don&rsquo;t pay them twice.`) : ''}
      ${p(`When the window closes we send you one list of everyone who claimed, with their bank details. You then pay each of them the full ticket price within <strong>${params.cancelDays} days</strong>, and report it with proof of payment.`)}
      ${p('Ventry does not return its platform fee on cancelled or refunded tickets.', true)}
      <a href="${params.dashboardUrl}" class="btn">Open your Refunds page</a>
    `),
  });
}

export async function sendRefundsOverdueEmail(params: { to: string; organiserName: string; eventName: string; payBy: string; dashboardUrl: string }) {
  await sendEmail({
    to: params.to,
    purpose: 'refunds_overdue',
    subject: `Overdue: refunds for ${params.eventName}`,
    html: emailShell(`
      <h1 style="color:#f87171;font-size:22px;margin:0 0 12px;">Your refunds are overdue</h1>
      ${p(`Hi ${esc(params.organiserName)}, the deadline to pay the refund claim list for <strong>${esc(params.eventName)}</strong> was ${fmtDay(params.payBy)}, and you haven&rsquo;t reported it paid.`)}
      ${p('Pay the buyers on the list and report it with proof of payment now. Unpaid valid claims are recorded against your account and can lead to your settlements being held, loss of your verification badge, suspension or removal (Organiser Terms §11).')}
      <a href="${params.dashboardUrl}" class="btn">Report refunds paid</a>
    `),
  });
}
