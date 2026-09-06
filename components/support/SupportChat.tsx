'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, RotateCcw } from 'lucide-react';
import { useBuyerAuth } from '@/lib/hooks/useBuyerAuth';

// The message history round-trips through the browser as an opaque blob —
// it's Anthropic's own MessageParam shape (text, tool_use, tool_result
// blocks), stateless multi-turn as recommended by the API. Nothing in it is
// secret: ACT tool handlers enforce identity from the real session cookie,
// never from anything in this history, so a tampered client-side history
// can't get a tool to act on someone else's order.
type ContentBlock = { type: string; text?: string; [key: string]: unknown };
interface Msg { role: 'user' | 'assistant'; content: string | ContentBlock[]; time: number; isError?: boolean }

const QUICK_ACTIONS = [
  "I paid but didn't get my ticket",
  'Find my ticket',
  'Event was changed or cancelled',
  'Check my complaint status',
  'Something else',
];

const HIDDEN_PREFIXES = ['/organizer', '/admin', '/affiliate', '/checkout'];

function textOf(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim();
}

function VentryMark({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-bold"
      style={{ width: size, height: size, backgroundColor: 'var(--color-purple)', color: '#fff', fontSize: size * 0.5, fontFamily: 'var(--font-syne), sans-serif' }}
    >
      V
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2 self-start">
      <VentryMark size={22} />
      <div className="flex items-center gap-1 rounded-2xl px-3 py-2.5" style={{ backgroundColor: 'var(--color-surface-2)' }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ backgroundColor: 'var(--color-text-dim)', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SupportChat() {
  const pathname = usePathname();
  const { firstName } = useBuyerAuth();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Mount immediately when opened, then flip a class on the next frame so
  // the CSS transition actually animates instead of snapping straight to
  // its end state.
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  if (HIDDEN_PREFIXES.some(p => pathname?.startsWith(p))) return null;

  const send = async (text: string, history: Msg[] = messages) => {
    if (!text.trim() || loading) return;
    const next: Msg[] = [...history, { role: 'user', content: text.trim(), time: Date.now() }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages([
          ...next,
          ...data.data.messages.slice(next.length).map((m: { role: 'user' | 'assistant'; content: string | ContentBlock[] }) => ({ ...m, time: Date.now() })),
        ]);
      } else {
        setMessages([...next, { role: 'assistant', content: data.error || 'Sorry, something went wrong.', time: Date.now(), isError: true }]);
      }
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Network error — please try again.', time: Date.now(), isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    // Trim off both the error bubble and the user message it responded to
    // *before* re-sending — passing the trimmed history explicitly (not
    // relying on a follow-up render of `messages`) is what avoids send()
    // re-appending a duplicate copy of that same user message.
    const trimmed = messages.slice(0, -2);
    setMessages(trimmed);
    send(textOf(lastUser.content), trimmed);
  };

  const greeting = firstName ? `Hi ${firstName}, what can I help with?` : 'Hi! What can I help with?';
  const fmtTime = (t: number) => new Date(t).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 flex flex-col overflow-hidden rounded-t-2xl sm:inset-auto sm:bottom-24 sm:right-4 sm:h-[560px] sm:w-[380px] sm:rounded-2xl sm:border sm:shadow-2xl transition-all duration-200 ease-out"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-purple)', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="rounded-full flex items-center justify-center font-bold" style={{ width: 30, height: 30, backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', fontFamily: 'var(--font-syne), sans-serif' }}>V</div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">Ventry Support</p>
                <p className="text-[11px] flex items-center gap-1 text-white/70 leading-tight">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: '#4ade80' }} />
                  Online
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <VentryMark size={26} />
                  <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm max-w-[85%]" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                    {greeting}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-9">
                  {QUICK_ACTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-xs rounded-full border px-3.5 py-2 transition-colors hover:border-[var(--color-purple)] hover:text-[var(--color-purple-light)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-2)' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const text = textOf(m.content);
              if (!text) return null;
              const isUser = m.role === 'user';
              return (
                <div key={i} className="flex flex-col gap-1" style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  <div className={`flex items-end gap-2 max-w-[90%] ${isUser ? 'flex-row-reverse' : ''}`}>
                    {!isUser && <VentryMark size={26} />}
                    <div
                      className={`px-3.5 py-2.5 text-sm whitespace-pre-wrap rounded-2xl ${isUser ? 'rounded-br-sm' : 'rounded-tl-sm'}`}
                      style={{
                        backgroundColor: m.isError ? '#ef444415' : isUser ? 'var(--color-purple)' : 'var(--color-surface-2)',
                        color: m.isError ? 'var(--color-red)' : isUser ? '#fff' : 'var(--color-text)',
                        border: m.isError ? '1px solid #ef444430' : undefined,
                      }}
                    >
                      {text}
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 text-[10px] ${isUser ? 'pr-1' : 'pl-9'}`} style={{ color: 'var(--color-text-dim)' }}>
                    {fmtTime(m.time)}
                    {m.isError && (
                      <button onClick={retry} className="flex items-center gap-1 font-medium hover:underline" style={{ color: 'var(--color-purple-light)' }}>
                        <RotateCcw size={10} />Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t px-3 py-3 flex-shrink-0"
            style={{ borderColor: 'var(--color-border)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 text-sm outline-none bg-transparent min-w-0 rounded-full px-4 py-2"
              style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface-2)' }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-purple)', color: '#fff' }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Support chat"
          className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: 'var(--color-purple)', color: '#fff', boxShadow: '0 4px 20px rgba(124,58,237,0.5)' }}
        >
          <MessageCircle size={22} />
        </button>
      )}
    </>
  );
}
