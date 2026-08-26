'use client';

import { usePathname } from 'next/navigation';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import { useAssistant } from './AssistantProvider';
import { GuideChat } from './GuideChat';

/**
 * Fixed-position assistant, mounted once in the admin layout so it's reachable
 * from every admin screen.
 *
 * It deliberately does NOT close on navigation: the panel and the conversation
 * live in the layout, so clicking a link inside an answer moves the page behind
 * it while the steps stay on screen. Only the ✕ closes it.
 */
export function AssistantDock({ live }: { live: boolean }) {
  const { open, setOpen, messages, busy, reset } = useAssistant();
  const pathname = usePathname();

  // The full-screen Assistant page already renders this same conversation.
  if (pathname === '/admin/assistant') return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open assistant"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition-colors hover:bg-emerald-500 print:hidden"
      >
        <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
        Assistant
        {busy && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Assistant"
      className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/60 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(36rem,calc(100dvh-6rem))] sm:w-[26rem] sm:rounded-2xl print:hidden"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Sparkles className="h-4 w-4 text-emerald-400" strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">Assistant</div>
          <div className="truncate text-[11px] text-gray-500">
            {live ? 'Grounded in your user guides' : 'Demo mode — set GEMINI_API_KEY'}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            aria-label="Start a new conversation"
            title="New conversation"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close assistant"
          title="Close — your conversation is kept"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <GuideChat variant="dock" />
    </div>
  );
}
