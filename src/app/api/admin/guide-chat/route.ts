import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { streamGuideChat, type ChatMessage } from '@/lib/ai/guide-chat';

const MAX_MESSAGES = 30;
const MAX_CHARS_PER_MESSAGE = 4000;

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: ChatMessage[] = [];
  for (const item of value.slice(-MAX_MESSAGES)) {
    const m = item as Record<string, unknown>;
    const role = m?.role === 'model' ? 'model' : m?.role === 'user' ? 'user' : null;
    const content = typeof m?.content === 'string' ? m.content.slice(0, MAX_CHARS_PER_MESSAGE) : null;
    if (!role || content === null) return null;
    out.push({ role, content });
  }
  // Conversation must end on a user turn.
  if (out[out.length - 1]?.role !== 'user') return null;
  return out;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const messages = parseMessages((json as Record<string, unknown>)?.messages);
  if (!messages) {
    return NextResponse.json({ error: 'invalid_messages' }, { status: 400 });
  }

  try {
    const stream = await streamGuideChat(messages);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[guide-chat]', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'assistant_unavailable', message }, { status: 502 });
  }
}
