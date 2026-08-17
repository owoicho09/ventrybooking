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

  const db = getServerSupabase();
  const { data, error } = await db
    .from('organizer_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return new NextResponse(htmlPage('That unsubscribe link is invalid or has already been used.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new NextResponse(htmlPage("You've been unsubscribed."), { headers: { 'Content-Type': 'text/html' } });
}
