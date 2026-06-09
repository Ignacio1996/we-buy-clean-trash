'use client';

import { useEffect, useRef, useState } from 'react';

interface Message {
  role: 'user' | 'model';
  content: string;
}

const SUGGESTIONS = [
  'How does a resident earn points?',
  'Walk me through the depot bag-processing flow.',
  'How do I invite an operator?',
  'How is the points payout calculated?',
];

/** Minimal Markdown → plain rendering: bold, bullets, numbered lists. */
function renderContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const bolded = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={j} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={j}>{part}</span>
      ),
    );
    return (
      <p key={i} className={line.trim() === '' ? 'h-2' : 'whitespace-pre-wrap'}>
        {bolded}
      </p>
    );
  });
}

export function GuideChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setInput('');

    const nextMessages: Message[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setBusy(true);
    // Placeholder assistant message we stream into.
    setMessages((m) => [...m, { role: 'model', content: '' }]);

    try {
      const res = await fetch('/api/admin/guide-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        // Surface the real server-side error message, not a generic string.
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.message) detail = body.message;
          else if (body?.error) detail = body.error;
        } catch {
          const text = await res.text().catch(() => '');
          if (text) detail = text;
        }
        throw new Error(detail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: 'model', content: acc };
          return copy;
        });
      }
      if (!acc.trim()) {
        throw new Error('empty');
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Assistant error: ${detail}`);
      // Drop the empty placeholder.
      setMessages((m) => {
        const copy = [...m];
        if (copy[copy.length - 1]?.role === 'model' && !copy[copy.length - 1].content) copy.pop();
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col rounded-2xl border border-white/10 bg-neutral-900/40">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {empty ? (
          <div className="mx-auto max-w-lg pt-8 text-center">
            <div className="text-3xl">💬</div>
            <h2 className="mt-3 text-lg font-semibold text-white">Ask anything about the app</h2>
            <p className="mt-1 text-sm text-gray-400">
              Grounded in your user guides — every role, every flow.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2.5 text-sm text-white'
                    : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-white/5 px-4 py-2.5 text-sm text-gray-200'
                }
              >
                {m.role === 'model' && !m.content ? (
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                  </span>
                ) : (
                  <div className="space-y-0.5">{renderContent(m.content)}</div>
                )}
              </div>
            </div>
          ))
        )}
        {error && (
          <p className="mx-auto max-w-[90%] whitespace-pre-wrap break-words rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-left font-mono text-xs text-red-300">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-white/10 p-3 sm:p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask about any role, screen, or flow…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
