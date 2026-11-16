import { emailShell, esc, sendToAdmins } from '@/lib/server/email';
import type { AdminReport } from '@/lib/server/adminReport';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;
const num = (n: number) => n.toLocaleString('en-NG');
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

const MUTED = '#9ca3af', TEXT = '#f1f0ff', LINE = '#2d2d3d', PANEL = '#12121a', UP = '#34d399', DOWN = '#f87171', AMBER = '#f59e0b';

/** "▲ 12% vs Sat" / "▼ 30% vs last week" / "new" / "same". */
function delta(cur: number, prev: number, vs: string): string {
  if (cur === prev) return `<span style="color:${MUTED};">same as ${vs}</span>`;
  if (prev === 0) return `<span style="color:${UP};">up from 0 ${vs}</span>`;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return `<span style="color:${up ? UP : DOWN};">${up ? '▲' : '▼'} ${Math.abs(pct)}%</span> <span style="color:${MUTED};">vs ${vs}</span>`;
}

function kpi(label: string, value: string, cur: number, prev: number, vs: string, avg?: string): string {
  return `<td width="50%" valign="top" style="padding:6px;">
    <div style="background:${PANEL};border:1px solid ${LINE};border-radius:10px;padding:14px;">
      <div style="color:${MUTED};font-size:12px;">${label}</div>
      <div style="color:${TEXT};font-size:22px;font-weight:700;margin:4px 0;">${value}</div>
      <div style="font-size:12px;">${delta(cur, prev, vs)}</div>
      ${avg ? `<div style="color:${MUTED};font-size:11px;margin-top:2px;">7-day avg ${avg}</div>` : ''}
    </div></td>`;
}

const h2 = (t: string) => `<h2 style="color:#c4b5fd;font-size:15px;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid ${LINE};">${t}</h2>`;
const row = (label: string, value: string, warn = false) =>
  `<tr><td style="padding:5px 0;color:${MUTED};font-size:13px;">${label}</td><td align="right" style="padding:5px 0;color:${warn ? AMBER : TEXT};font-size:13px;font-weight:${warn ? 700 : 400};">${value}</td></tr>`;
const rows = (r: string[]) => `<table width="100%" cellpadding="0" cellspacing="0">${r.join('')}</table>`;
const none = (t: string) => `<p style="color:${MUTED};font-size:13px;margin:4px 0;">${t}</p>`;
const lagosTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', hour: 'numeric', minute: '2-digit' });
const lagosDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Things the owner should act on, worst first. Empty = all clear. */
function attention(r: AdminReport): string[] {
  const a: string[] = [];
  if (r.health.criticalAlerts.length) a.push(`<strong>${plural(r.health.criticalAlerts.length, 'critical alert')}</strong> (payments, settlements or refunds), listed under System health`);
  if (r.money.failedSettlements) a.push(`<strong>${plural(r.money.failedSettlements, 'settlement')} failed</strong> and need a retry`);
  if (r.money.refundCasesOverdue) a.push(`<strong>${plural(r.money.refundCasesOverdue, 'refund case')} overdue</strong>: organisers haven't paid buyers back on time`);
  if (!r.health.emails.reportsArriving) a.push(`<strong>Email delivery reports aren't arriving</strong>, so bounces and suppressions can't be seen. Set RESEND_WEBHOOK_SECRET in Vercel and point the Resend webhook at www.ventrybooking.com/api/webhooks/resend`);
  const badMail = r.health.emails.bounced + r.health.emails.suppressed + r.health.emails.complained + r.health.emails.failed;
  if (badMail) a.push(`<strong>${plural(badMail, 'email')} not delivered</strong> (bounced, suppressed, spam or failed)`);
  if (r.events.awaitingReview) a.push(`<strong>${plural(r.events.awaitingReview, 'event')} waiting for review</strong>${r.events.oldestWaitHours != null ? `, the oldest for ${plural(r.events.oldestWaitHours, 'hour')}` : ''}`);
  if (r.money.withdrawalsPending) a.push(`${plural(r.money.withdrawalsPending, 'withdrawal request')} waiting`);
  if (r.support.complaintsOpen) a.push(`${plural(r.support.complaintsOpen, 'support complaint')} open`);
  if (r.organisers.onHold) a.push(`${plural(r.organisers.onHold, 'organiser')} with settlements on hold`);
  return a;
}

export function adminReportHtml(r: AdminReport): string {
  const daily = r.period === 'day';
  const vs = daily ? new Date(new Date(r.start).getTime() - 86_400_000 + 3600_000).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }) : 'the week before';
  const s = r.sales, p = r.previous, avg = r.avg7;
  const att = attention(r);
  const conv = r.health.checkoutsStarted ? Math.round((r.health.checkoutsCompleted / r.health.checkoutsStarted) * 100) : null;

  const top = r.topEvents.length
    ? `<table width="100%" cellpadding="0" cellspacing="0">${r.topEvents.map(e => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid ${LINE};color:${TEXT};font-size:13px;">${esc(e.name)}</td>
        <td align="right" style="padding:6px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:13px;white-space:nowrap;">${plural(e.tickets, 'ticket')}</td>
        <td align="right" style="padding:6px 0 6px 12px;border-bottom:1px solid ${LINE};color:${TEXT};font-size:13px;white-space:nowrap;">${e.gross ? naira(e.gross) : 'Free'}</td></tr>`).join('')}</table>`
    : none(`No tickets sold ${daily ? 'yesterday' : 'last week'}.`);

  const upcoming = r.events.happeningNext7d.length
    ? rows(r.events.happeningNext7d.map(e => row(`${lagosDay(e.date)} · ${esc(e.name)}`, e.available ? `${num(e.sold)} / ${num(e.available)} sold (${Math.round((e.sold / e.available) * 100)}%)` : `${num(e.sold)} sold`)))
    : none('No events in the next 7 days.');

  const html = `
    <p style="color:${MUTED};font-size:12px;margin:0;text-transform:uppercase;letter-spacing:.08em;">Ventry ${daily ? 'daily' : 'weekly'} report</p>
    <h1 style="color:${TEXT};font-size:22px;margin:4px 0 18px;">${esc(r.label)}</h1>

    <div style="border-radius:10px;padding:14px 16px;margin-bottom:8px;background:${att.length ? '#f59e0b14' : '#10b98114'};border:1px solid ${att.length ? '#f59e0b55' : '#10b98155'};">
      <div style="color:${att.length ? AMBER : UP};font-weight:700;font-size:14px;margin-bottom:${att.length ? '6px' : '0'};">${att.length ? 'Needs your attention' : 'Nothing needs your attention'}</div>
      ${att.length ? `<ul style="margin:0;padding-left:18px;color:${TEXT};font-size:13px;line-height:1.5;">${att.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    </div>

    ${h2('Sales')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px;"><tr>
      ${kpi('Tickets sold', num(s.tickets), s.tickets, p.tickets, vs, avg ? num(avg.tickets) : undefined)}
      ${kpi('Gross sales (buyers paid)', naira(s.gross), s.gross, p.gross, vs, avg ? naira(avg.gross) : undefined)}
    </tr><tr>
      ${kpi('Ventry revenue', naira(s.ventryRevenue), s.ventryRevenue, p.ventryRevenue, vs, avg ? naira(avg.ventryRevenue) : undefined)}
      ${kpi('Organisers’ net', naira(s.organiserNet), s.organiserNet, p.organiserNet, vs, avg ? naira(avg.organiserNet) : undefined)}
    </tr><tr>
      ${kpi('Orders', num(s.orders), s.orders, p.orders, vs, avg ? num(avg.orders) : undefined)}
      ${kpi('Buyers', num(s.buyers), s.buyers, p.buyers, vs, avg ? num(avg.buyers) : undefined)}
    </tr></table>
    <p style="color:${MUTED};font-size:12px;margin:8px 0 0;">${plural(r.newBuyers, 'first-time buyer')} · ${num(s.paidTickets)} paid, ${num(s.freeTickets)} free · ${plural(r.eventsOnSale, 'event')} on sale now</p>

    ${h2('Top events')}
    ${top}

    ${h2('Events')}
    ${rows([
      row('Submitted for review', num(r.events.submitted)),
      row('Approved', num(r.events.approved)),
      row('Rejected', num(r.events.rejected)),
      row('Cancelled', num(r.events.cancelled), r.events.cancelled > 0),
      row('Waiting for review now', r.events.awaitingReview ? `${num(r.events.awaitingReview)}${r.events.oldestWaitHours != null ? ` (oldest ${plural(r.events.oldestWaitHours, 'hour')})` : ''}` : '0', r.events.awaitingReview > 0),
      ...r.events.goingLiveNext24h.map(e => row(`Goes on sale ${lagosTime(e.at)}`, esc(e.name))),
    ])}
    <p style="color:${MUTED};font-size:12px;margin:12px 0 4px;">Happening in the next 7 days</p>
    ${upcoming}

    ${h2('Organisers')}
    ${rows([
      row('New sign-ups', num(r.organisers.newSignups.length)),
      ...r.organisers.newSignups.slice(0, 10).map(u => row(`&nbsp;&nbsp;${esc(u.name || 'No name yet')}`, esc(u.email))),
      row('Identity verified', num(r.organisers.identityVerified)),
      row('All organisers (not yet verified)', `${num(r.organisers.total)} (${num(r.organisers.unverified)})`),
      row('Settlements on hold', num(r.organisers.onHold), r.organisers.onHold > 0),
    ])}

    ${h2('Money out')}
    ${rows([
      row('Settled to organisers', r.money.settledCount ? `${naira(r.money.settledNet)} in ${plural(r.money.settledCount, 'payment')}` : 'None'),
      row('Settlements failed (all time, unresolved)', num(r.money.failedSettlements), r.money.failedSettlements > 0),
      row('Settlements in progress', num(r.money.processingSettlements)),
      row('Withdrawals requested', r.money.withdrawalsRequested ? `${naira(r.money.withdrawalsRequestedAmount)} (${num(r.money.withdrawalsRequested)})` : 'None'),
      row('Withdrawals waiting', num(r.money.withdrawalsPending), r.money.withdrawalsPending > 0),
      row('Tickets refunded', r.money.refundedTickets ? `${num(r.money.refundedTickets)} (${naira(r.money.refundedAmount)})` : 'None'),
      row('New refund claims', num(r.money.refundClaimsNew)),
      row('Refund cases open (overdue)', `${num(r.money.refundCasesOpen)} (${num(r.money.refundCasesOverdue)})`, r.money.refundCasesOverdue > 0),
      row('Affiliate commissions earned', r.money.affiliateCommissions ? `${naira(r.money.affiliateCommissionAmount)} (${num(r.money.affiliateCommissions)})` : 'None'),
      row('New affiliate referrals', num(r.money.newReferrals)),
    ])}

    ${h2('System health')}
    ${rows([
      row('Paid checkouts started → completed', `${num(r.health.checkoutsStarted)} → ${num(r.health.checkoutsCompleted)}${conv != null ? ` (${conv}%)` : ''}`),
      row('Check-ins at the door', `${num(r.health.checkIns)}${r.health.invalidScans ? ` (${num(r.health.invalidScans)} rejected scans)` : ''}`),
      row('Emails sent', num(r.health.emails.sent)),
      row('Delivered', r.health.emails.reportsArriving ? num(r.health.emails.delivered) : 'unknown (reports not arriving)', !r.health.emails.reportsArriving),
      row('Bounced / suppressed / spam / failed', `${num(r.health.emails.bounced)} / ${num(r.health.emails.suppressed)} / ${num(r.health.emails.complained)} / ${num(r.health.emails.failed)}`, r.health.emails.bounced + r.health.emails.suppressed + r.health.emails.complained + r.health.emails.failed > 0),
    ])}
    ${r.health.criticalAlerts.length ? `<p style="color:${AMBER};font-size:12px;margin:12px 0 4px;font-weight:700;">Critical alerts</p>${rows(r.health.criticalAlerts.map(c => row(esc(c.title), lagosTime(c.at), true)))}` : ''}

    ${h2('Security')}
    ${rows([
      row('New-device sign-ins confirmed', `${num(r.security.newDeviceSignIns)} of ${plural(r.security.signInCodesSent, 'code')} sent`),
      row('Settings changes confirmed by code', num(r.security.settingsChanges)),
      row('Organiser email changes', num(r.security.organiserEmailChanges), r.security.organiserEmailChanges > 0),
      row('Payout account changes', num(r.security.payoutAccountChanges), r.security.payoutAccountChanges > 0),
      row('Wrong promo codes entered', num(r.security.wrongPromoCodes), r.security.wrongPromoCodes >= 50),
    ])}

    ${h2('Support')}
    ${rows([
      row('New complaints', num(r.support.complaintsNew)),
      row('Open complaints', num(r.support.complaintsOpen), r.support.complaintsOpen > 0),
      row('Support assistant this month', r.support.chatCallsMonth != null ? `${plural(r.support.chatCallsMonth, 'reply', 'replies')}, $${(r.support.chatCostUsdMonth ?? 0).toFixed(2)}` : 'Not used'),
    ])}

    ${r.alerts.length ? `${h2('Everything the system flagged')}${rows(r.alerts.map(a => row(esc(a.title), num(a.count))))}` : ''}

    <div style="margin-top:26px;"><a href="${APP_URL}/admin" class="btn">Open the admin dashboard</a></div>
    <p class="footer">Covers ${esc(r.label)} (Lagos time). Gross is what buyers paid; Ventry revenue is service fees plus commission; organisers’ net is ticket prices after commission.</p>
  `;
  return emailShell(html);
}

/** Sends the report to every admin recipient once; `purpose` makes it idempotent. */
export async function sendAdminReportEmail(r: AdminReport, purpose: string) {
  const subject = r.period === 'day'
    ? `Ventry daily: ${plural(r.sales.tickets, 'ticket')}, ${naira(r.sales.gross)} · ${r.label}`
    : `Ventry weekly: ${plural(r.sales.tickets, 'ticket')}, ${naira(r.sales.gross)} · ${r.label}`;
  await sendToAdmins({ subject, html: adminReportHtml(r), purpose });
}
