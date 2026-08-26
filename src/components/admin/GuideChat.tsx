'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isInternalAdminHref } from '@/lib/ai/admin-routes';
import { useAssistant, type Message } from './AssistantProvider';

const SUGGESTIONS = [
  'How does a resident earn points?',
  'Walk me through the depot bag-processing flow.',
  'How do I invite an operator?',
  'How is the points payout calculated?',
];

/** `[label](/admin/...)` → an in-app link; `**bold**` → bold. */
const TOKEN = /(\[[^\]\n]+\]\([^)\s]+\)|\*\*[^*\n]+\*\*)/g;

function renderInline(line: string): ReactNode[] {
  return line.split(TOKEN).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      // Only paths from the known admin route table become real links —
      // anything else (a hallucinated path, an external URL) renders as text.
      if (isInternalAdminHref(href)) {
        return (
          <Link
            key={i}
            href={href}
            className="font-medium text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300 hover:decoration-emerald-300"
          >
            {label}
          </Link>
        );
      }
      return <span key={i}>{label}</span>;
    }

    return <span key={i}>{part}</span>;
  });
}

/** Minimal Markdown → plain rendering: links, bold, bullets, numbered lists. */
function renderContent(text: string) {
  return text.split('\n').map((line, i) => (
    <p key={i} className={line.trim() === '' ? 'h-2' : 'whitespace-pre-wrap'}>
      {renderInline(line)}
    </p>
  ));
}

function Bubble({ message }: { message: Message }) {
  return (
    <div className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          message.role === 'user'
            ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2.5 text-sm text-white'
            : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-white/5 px-4 py-2.5 text-sm text-gray-200'
        }
      >
        {message.role === 'model' && !message.content ? (
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
          </span>
        ) : (
          <div className="space-y-0.5">{renderContent(message.content)}</div>
        )}
      </div>
    </div>
  );
}

/**
 * The conversation itself. Conversation state lives in AssistantProvider, so the
 * docked panel and the full-screen /admin/assistant page are the same thread.
 *
 * `variant` only affects sizing: 'page' fills the admin content column, 'dock'
 * fills its fixed panel.
 */
export function GuideChat({ variant = 'page' }: { variant?: 'page' | 'dock' }) {
  const { messages, busy, error, send } = useAssistant();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  function submit() {
    if (busy || !input.trim()) return;
    send(input);
    setInput('');
  }

  const dock = variant === 'dock';
  const empty = messages.length === 0;

  return (
    <div
      className={
        dock
          ? 'flex min-h-0 flex-1 flex-col'
          : 'flex h-[calc(100dvh-9rem)] flex-col rounded-2xl border border-white/10 bg-neutral-900/40'
      }
    >
      <div
        ref={scrollRef}
        className={`flex-1 space-y-4 overflow-y-auto ${dock ? 'px-4 py-4' : 'px-4 py-5 sm:px-6'}`}
      >
        {empty ? (
          <div className={`mx-auto max-w-lg text-center ${dock ? 'pt-2' : 'pt-8'}`}>
            <div className="text-3xl">💬</div>
            <h2 className="mt-3 text-lg font-semibold text-white">Ask anything about the app</h2>
            <p className="mt-1 text-sm text-gray-400">
              Grounded in your user guides — every role, every flow.
            </p>
            <div className={`mt-6 grid gap-2 ${dock ? '' : 'sm:grid-cols-2'}`}>
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
          messages.map((m, i) => <Bubble key={i} message={m} />)
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
          submit();
        }}
        className={`flex items-end gap-2 border-t border-white/10 ${dock ? 'p-3' : 'p-3 sm:p-4'}`}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
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
