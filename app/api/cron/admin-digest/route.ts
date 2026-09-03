import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendAdminDigestEmail } from '@/lib/server/email';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServerSupabase();

    const { data: rows, error } = await db
      .from('notifications')
      .select('id, title, body, link')
      .eq('recipient_type', 'admin')
      .is('emailed_at', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    await sendAdminDigestEmail(rows.map(r => ({ title: r.title, body: r.body, link: r.link })));

    const { error: updateErr } = await db
      .from('notifications')
      .update({ emailed_at: new Date().toISOString() })
      .in('id', rows.map(r => r.id));
    if (updateErr) console.error('admin-digest: failed to stamp emailed_at', updateErr);

    return NextResponse.json({ success: true, sent: rows.length });
  } catch (err) {
    console.error('GET /api/cron/admin-digest error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
