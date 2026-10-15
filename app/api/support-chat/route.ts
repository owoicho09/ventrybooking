import { NextRequest, NextResponse } from 'next/server';
import { getBuyerAuth } from '@/lib/server/buyerAuth';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { runAgentLoop, type ChatMessage } from '@/lib/server/agent/runLoop';
import { buildBuyerRole } from '@/lib/server/agent/roles/buyer';

// Counts every message in the history, tool calls included (a turn that
// uses tools adds 3-5), so this is roughly 8-10 back-and-forths. Long
// chats get expensive because the whole history is resent each call.
const MAX_MESSAGES = 30;

export async function POST(req: NextRequest) {
  const ip = getIp(req.headers);
  if (!checkRateLimit(`support-chat-ip:${ip}`, 12, 10 * 60)) {
    return NextResponse.json({ error: 'Too many messages. Please wait a moment.' }, { status: 429 });
  }

  try {
    const { messages, page } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json({ error: 'This conversation has gotten long — please start a new chat.' }, { status: 400 });
    }
    if (typeof messages[messages.length - 1]?.content === 'string' && messages[messages.length - 1].content.length > 1000) {
      return NextResponse.json({ error: 'That message is a bit long — please keep it under 1,000 characters.' }, { status: 400 });
    }

    const buyer = await getBuyerAuth();
    if (buyer && !checkRateLimit(`support-chat-email:${buyer.email}`, 12, 10 * 60)) {
      return NextResponse.json({ error: 'Too many messages. Please wait a moment.' }, { status: 429 });
    }

    // Organisers and affiliates log in separately from buyers; knowing who's
    // asking (and from which page) lets the assistant tailor its answers.
    const user = await getAuthUser();
    let account: { role: 'organizer' | 'affiliate' | 'admin'; name: string | null } | null = null;
    if (user && user.role !== 'buyer') {
      const { data } = await getServerSupabase().from('users').select('name').eq('id', user.sub).maybeSingle();
      account = { role: user.role, name: data?.name ?? null };
    }
    const pagePath = typeof page === 'string' && /^\/[\w\-/]{0,120}$/.test(page) ? page : null;

    const history: ChatMessage[] = messages;
    const role = buildBuyerRole({ buyerEmail: buyer?.email ?? null, account, page: pagePath }, history);
    const updated = await runAgentLoop(role, history);

    return NextResponse.json({ success: true, data: { messages: updated } });
  } catch (err) {
    console.error('POST /api/support-chat error', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
