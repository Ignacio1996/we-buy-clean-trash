import { NextResponse } from 'next/server';
import { scanImage } from '@/lib/ai/scan';

export const runtime = 'nodejs';

const MAX_BASE64_CHARS = 8 * 1024 * 1024; // ~6 MB decoded — rough safety cap

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const raw = (json ?? {}) as Record<string, unknown>;
  const imageBase64 = typeof raw.imageBase64 === 'string' ? raw.imageBase64 : '';
  if (!imageBase64) return NextResponse.json({ error: 'missing_image' }, { status: 400 });
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return NextResponse.json({ error: 'image_too_large' }, { status: 413 });
  }

  // Pre-signup is session-only per locked-in decisions — no Firestore writes here.
  const result = await scanImage(imageBase64);
  return NextResponse.json(result);
}
