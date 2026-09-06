import { NextRequest, NextResponse } from 'next/server';
import { getBuyerAuth } from '@/lib/server/buyerAuth';
import { checkRateLimit, getIp } from '@/lib/server/rateLimit';
import { runAgentLoop, type ChatMessage } from '@/lib/server/agent/runLoop';
import { buildBuyerRole } from '@/lib/server/agent/roles/buyer';

const MAX_MESSAGES = 40;

export async function POST(req: NextRequest) {
  const ip = getIp(req.headers);
  if (!checkRateLimit(`support-chat-ip:${ip}`, 20, 10 * 60)) {
    return NextResponse.json({ error: 'Too many messages. Please wait a moment.' }, { status: 429 });
  }

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json({ error: 'This conversation has gotten long — please start a new chat.' }, { status: 400 });
    }

    const buyer = await getBuyerAuth();
    if (buyer && !checkRateLimit(`support-chat-email:${buyer.email}`, 20, 10 * 60)) {
      return NextResponse.json({ error: 'Too many messages. Please wait a moment.' }, { status: 429 });
    }

    const history: ChatMessage[] = messages;
    const role = buildBuyerRole(buyer?.email ?? null, history);
    const updated = await runAgentLoop(role, history);

    return NextResponse.json({ success: true, data: { messages: updated } });
  } catch (err) {
    console.error('POST /api/support-chat error', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
