import 'server-only';
import { GUIDE_KB, GUIDE_KB_SOURCES } from './guide-kb.generated';
import { adminRouteMap } from './admin-routes';

export interface ChatMessage {
  /** 'user' for the admin, 'model' for the assistant. */
  role: 'user' | 'model';
  content: string;
}

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent`;

const SYSTEM_INSTRUCTION = `You are the in-app assistant for "We Buy Clean Trash" (WBCT), a recycling-rewards platform. You answer questions from an ADMIN about how the app works, for every role (resident, operator, depot worker, depot manager, admin).

Your knowledge comes ONLY from the user-guide documentation provided below. Follow these rules:
- Answer using the documentation. Be concise, concrete, and practical — prefer short paragraphs and bullet/numbered steps.
- If the guides describe a screen, button, or flow, name it exactly as the guides do.
- If a question is not covered by the documentation, say so plainly (e.g. "The guides don't cover that") and suggest where the admin might look — do NOT invent features, prices, or steps.
- Never expose secrets, API keys, or test-account passwords unless they appear verbatim in the documentation and the admin clearly needs them.
- You may use light Markdown (bold, bullets, numbered lists). Keep answers focused on the question.

LINKING — this matters:
- Whenever your answer tells the admin to go somewhere in the app, link the screen with a Markdown link to its real path, e.g. "Open [Staff invites](/admin/invites) and click Send invite."
- Only ever link paths from the ADMIN SCREENS table below. Never invent a path, never link an external URL, and never link to a screen that isn't in the table.
- Link the screen the FIRST time you name it in an answer; after that, just use its name.
- For a multi-step answer, link the screen in the step where the admin needs it, so they can click through step by step.
- The assistant panel stays open when the admin clicks one of these links, so write the steps expecting them to be read alongside the screen.

=== ADMIN SCREENS ===
${adminRouteMap()}
=== END ADMIN SCREENS ===

The documentation covers these guides: ${GUIDE_KB_SOURCES.join('; ')}.

=== BEGIN DOCUMENTATION ===
${GUIDE_KB}
=== END DOCUMENTATION ===`;

/** True when a real Gemini key is configured; otherwise we serve a mock. */
export function guideChatIsLive(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function mockStream(messages: ChatMessage[]): ReadableStream<Uint8Array> {
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const text =
    `**Assistant is in demo mode** (no \`GEMINI_API_KEY\` set).\n\n` +
    `Once a key is configured, I'll answer questions like "${last.slice(0, 120)}" ` +
    `using the ${GUIDE_KB_SOURCES.length} user guides as my source.`;
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/**
 * Streams a grounded answer from Gemini as plain UTF-8 text deltas.
 * `messages` is the full conversation in order (oldest first), ending with the
 * latest user turn. Returns a mock stream when no API key is configured.
 */
export async function streamGuideChat(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return mockStream(messages);

  const contents = messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, parts: [{ text: m.content }] }));

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1536,
      // gemini-2.5-flash is a thinking model; for grounded doc Q&A we disable
      // thinking so latency stays low and the full token budget goes to the answer.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(`${ENDPOINT}?alt=sse&key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`gemini_error_${res.status}: ${detail.slice(0, 300)}`);
  }

  // Transform Gemini's SSE stream into plain text deltas.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const parts = json?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const p of parts) {
                if (typeof p?.text === 'string' && p.text) {
                  controller.enqueue(encoder.encode(p.text));
                }
              }
            }
          } catch {
            // Partial JSON across a chunk boundary — re-buffer this line and the
            // rest of the chunk, then wait for the next chunk to complete it.
            buffer = lines.slice(i).join('\n') + '\n' + buffer;
            return;
          }
        }
      },
    }),
  );
}
