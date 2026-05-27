import { NextResponse } from 'next/server';
import { autocompletePlaces } from '@/lib/maps/places';

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const input = typeof raw.input === 'string' ? raw.input : '';
  const sessionToken = typeof raw.sessionToken === 'string' ? raw.sessionToken : '';
  if (!sessionToken) {
    return NextResponse.json({ error: 'missing_session_token' }, { status: 400 });
  }
  const suggestions = await autocompletePlaces({ input, sessionToken });
  return NextResponse.json({ suggestions });
}
