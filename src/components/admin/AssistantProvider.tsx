'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface Message {
  role: 'user' | 'model';
  content: string;
}

interface AssistantState {
  messages: Message[];
  busy: boolean;
  error: string | null;
  /** Dock panel open/closed. The full-screen /admin/assistant page ignores this. */
  open: boolean;
  setOpen: (open: boolean) => void;
  send: (text: string) => void;
  reset: () => void;
}

const AssistantContext = createContext<AssistantState | null>(null);

// Conversation + panel state live here, in the admin layout, so they survive
// client-side navigation — the whole point of the dock is that clicking a link
// in an answer takes you to the screen WITHOUT losing the answer. sessionStorage
// carries them across a hard reload too.
const STORAGE_KEY = 'wbct.admin.assistant';
const MAX_STORED_CHARS = 60_000;

interface StoredState {
  messages: Message[];
  open: boolean;
}

function readStored(): StoredState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (!Array.isArray(parsed?.messages)) return null;
    return {
      messages: parsed.messages.filter(
        (m) => (m?.role === 'user' || m?.role === 'model') && typeof m?.content === 'string',
      ),
      open: Boolean(parsed.open),
    };
  } catch {
    return null;
  }
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Rendered on the server as empty, so restore after mount to avoid a mismatch.
  const [hydrated, setHydrated] = useState(false);
  const busyRef = useRef(false);
  // Mirrors `messages` so send() can read the current conversation without
  // re-creating itself on every streamed token.
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setMessages(stored.messages);
      setOpen(stored.open);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || busy) return;
    try {
      const payload = JSON.stringify({ messages, open } satisfies StoredState);
      if (payload.length > MAX_STORED_CHARS) {
        // Keep the tail of a long conversation rather than dropping all of it.
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ messages: messages.slice(-10), open } satisfies StoredState),
        );
      } else {
        window.sessionStorage.setItem(STORAGE_KEY, payload);
      }
    } catch {
      // Storage full or blocked — the in-memory conversation still works.
    }
  }, [messages, open, busy, hydrated]);

  const send = useCallback((text: string) => {
    const question = text.trim();
    if (!question || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setBusy(true);

    const history: Message[] = [...messagesRef.current, { role: 'user', content: question }];
    messagesRef.current = history;
    // Plus a placeholder assistant message we stream into.
    setMessages([...history, { role: 'model', content: '' }]);

    void (async () => {
      try {
        const res = await fetch('/api/admin/guide-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
        });

        if (!res.ok || !res.body) {
          // Surface the real server-side error message, not a generic string.
          let detail = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            if (body?.message) detail = body.message;
            else if (body?.error) detail = body.error;
          } catch {
            const body = await res.text().catch(() => '');
            if (body) detail = body;
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
        if (!acc.trim()) throw new Error('empty');
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setError(`Assistant error: ${detail}`);
        // Drop the empty placeholder.
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.role === 'model' && !last.content) copy.pop();
          return copy;
        });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    })();
  }, []);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    setMessages([]);
    setError(null);
  }, []);

  return (
    <AssistantContext.Provider value={{ messages, busy, error, open, setOpen, send, reset }}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant(): AssistantState {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used inside <AssistantProvider>');
  return ctx;
}
