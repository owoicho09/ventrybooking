import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

function htmlPage(message: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ventry</title>
<style>
  body { background:#0a0a0f; color:#f1f0ff; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; text-align:center; }
  .card { max-width:420px; }
  h1 { font-size:20px; margin-bottom:8px; }
  p { color:#8b8aa3; font-size:14px; }
  a { color:#a855f7; }
</style></head>
<body><div class="card"><h1>${message}</h1><p><a href="/">Back to Ventry</a></p></div></body></html>`;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return new NextResponse(htmlPage('Missing unsubscribe token'), { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  // Each list has its own tokens, so an unsubscribe only ever leaves the one
  // list the link came from: an organiser's Audience or Ventry's own list.
  const db = getServerSupabase();
  const now = new Date().toISOString();

  const { data: orgRow, error: orgErr } = await db
    .from('organizer_subscribers')
    .update({ unsubscribed_at: now })
    .eq('unsubscribe_token', token)
    .select('id, organizer:users!organizer_subscribers_organizer_id_fkey(name)')
    .maybeSingle();

  if (!orgErr && orgRow) {
    const org = (Array.isArray(orgRow.organizer) ? orgRow.organizer[0] : orgRow.organizer) as { name: string } | null;
    return new NextResponse(
      htmlPage(`You've been unsubscribed from ${escapeHtml(org?.name ?? 'this organiser')}'s updates.`),
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  const { data: ventryRow, error: ventryErr } = await db
    .from('ventry_subscribers')
    .update({ unsubscribed_at: now })
    .eq('unsubscribe_token', token)
    .select('id')
    .maybeSingle();

  if (!ventryErr && ventryRow) {
    return new NextResponse(htmlPage("You've been unsubscribed from Ventry's updates."), { headers: { 'Content-Type': 'text/html' } });
  }

  return new NextResponse(htmlPage('That unsubscribe link is invalid or has already been used.'), {
    status: 404,
    headers: { 'Content-Type': 'text/html' },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
