import { NextResponse } from 'next/server';
import { getPlaceDetails } from '@/lib/maps/places';

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const placeId = typeof raw.placeId === 'string' ? raw.placeId.trim() : '';
  const sessionToken = typeof raw.sessionToken === 'string' ? raw.sessionToken : '';
  if (!placeId || !sessionToken) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const details = await getPlaceDetails({ placeId, sessionToken });
  if (!details) {
    return NextResponse.json({ error: 'place_not_found' }, { status: 404 });
  }
  return NextResponse.json({ address: details });
}
