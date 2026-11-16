import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/server/auth';
import { buildAdminReport, defaultPeriodStart, type ReportPeriod } from '@/lib/server/adminReport';
import { adminReportHtml } from '@/lib/server/adminReportEmail';
import { sendReport } from '@/lib/server/adminReportJob';

/**
 * The owner's daily/weekly report, on demand. The scheduled sends happen in
 * the hourly admin-digest cron; this is for previews and re-sends.
 *
 *   ?period=day|week   (default day)
 *   ?date=YYYY-MM-DD   start of the period (default: yesterday / last Monday)
 *   ?format=html       show the email in the browser instead of sending
 *   ?send=1            send it now (once per period; &force=1 sends again)
 *
 * Allowed with the cron secret, or signed in as admin (so the report can be
 * previewed at /api/cron/admin-report?format=html from the admin browser).
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const viaCron = !!cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`;
  const user = viaCron ? null : await getAuthUser();
  if (!viaCron && user?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const period: ReportPeriod = q.get('period') === 'week' ? 'week' : 'day';
  const dateParam = q.get('date');
  const start = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : defaultPeriodStart(period);
  const db = getServerSupabase();

  try {
    if (q.get('send') === '1') {
      const result = await sendReport(db, period, start, { force: q.get('force') === '1' });
      return NextResponse.json({ success: true, data: result });
    }
    const report = await buildAdminReport(db, period, start);
    if (q.get('format') === 'html') {
      return new NextResponse(adminReportHtml(report), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ success: true, data: report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/cron/admin-report error', err);
    return NextResponse.json({ error: 'Could not build the report' }, { status: 500 });
  }
}
