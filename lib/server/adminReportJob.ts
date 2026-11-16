import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAdminReport, defaultPeriodStart, lagosDate, type ReportPeriod } from '@/lib/server/adminReport';
import { sendAdminReportEmail } from '@/lib/server/adminReportEmail';

/**
 * Sends the owner's reports when they are due. Called by the hourly
 * admin-digest cron, so no extra scheduler job is needed:
 *   - daily report for yesterday, from 07:00 Lagos time
 *   - weekly report for last Monday-Sunday, Mondays from 07:00
 * "From 07:00" (not "at"): if the 07:00 run fails or is late, the next hourly
 * run sends it. Each report goes out once: its send is recorded in
 * email_deliveries under a per-report purpose key, and a run skips any key
 * already there.
 */
export const reportPurpose = (period: ReportPeriod, start: string) => `admin_report_${period}:${start}`;

const SEND_FROM_HOUR = 7;

async function alreadySent(db: SupabaseClient, purpose: string): Promise<boolean> {
  const { count } = await db.from('email_deliveries').select('id', { count: 'exact', head: true }).eq('purpose', purpose);
  return (count ?? 0) > 0;
}

export async function sendReport(db: SupabaseClient, period: ReportPeriod, start: string, opts: { force?: boolean } = {}) {
  const purpose = reportPurpose(period, start);
  if (!opts.force && await alreadySent(db, purpose)) return { period, start, sent: false, reason: 'already sent' };
  const report = await buildAdminReport(db, period, start);
  await sendAdminReportEmail(report, purpose);
  return { period, start, sent: true };
}

export async function runScheduledAdminReports(db: SupabaseClient, now = new Date()) {
  const hour = Number(now.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hour12: false }));
  if (hour < SEND_FROM_HOUR) return [];
  const results = [await sendReport(db, 'day', defaultPeriodStart('day', now))];
  const isMonday = new Date(`${lagosDate(now)}T12:00:00Z`).getUTCDay() === 1;
  if (isMonday) results.push(await sendReport(db, 'week', defaultPeriodStart('week', now)));
  return results;
}
