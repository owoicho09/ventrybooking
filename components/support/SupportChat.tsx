'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send } from 'lucide-react';

// The message history round-trips through the browser as an opaque blob —
// it's Anthropic's own MessageParam shape (text, tool_use, tool_result
// blocks), stateless multi-turn as recommended by the API. Nothing in it is
// secret: ACT tool handlers enforce identity from the real session cookie,
// never from anything in this history, so a tampered client-side history
// can't get a tool to act on someone else's order.
type ContentBlock = { type: string; text?: string; [key: string]: unknown };
interface Msg { role: 'user' | 'assistant'; content: string | ContentBlock[] }

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

export function SupportChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (HIDDEN_PREFIXES.some(p => pathname?.startsWith(p))) return null;

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: 'user' as const, content: text.trim() }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(data.data.messages);
      } else {
        setMessages([...next, { role: 'assistant', content: data.error || "Sorry, something went wrong. Please try again." }]);
      }
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Network error — please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          className="flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            width: 'min(380px, calc(100vw - 2rem))',
            height: 'min(560px, calc(100vh - 6rem))',
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-purple)' }}>
            <p className="text-sm font-semibold text-white">Ventry Support</p>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Hi! What can I help with?
                </p>
                {QUICK_ACTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-left text-sm rounded-lg border px-3 py-2 transition-colors hover:border-[var(--color-purple)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => {
              const text = textOf(m.content);
              if (!text) return null;
              const isUser = m.role === 'user';
              return (
                <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${isUser ? 'self-end' : 'self-start'}`}
                  style={{
                    backgroundColor: isUser ? 'var(--color-purple)' : 'var(--color-surface-2)',
                    color: isUser ? '#fff' : 'var(--color-text)',
                  }}
                >
                  {text}
                </div>
              );
            })}
            {loading && (
              <div className="self-start text-sm" style={{ color: 'var(--color-text-dim)' }}>Typing…</div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t px-3 py-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: 'var(--color-text)' }}
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Send" style={{ color: 'var(--color-purple)' }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Support chat"
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: 'var(--color-purple)', color: '#fff' }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
