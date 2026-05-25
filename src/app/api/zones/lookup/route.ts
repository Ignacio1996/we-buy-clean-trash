import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { resolvePickupDays, type ZoneDoc } from '@/lib/types/zone';

export const runtime = 'nodejs';

// Public — used by the signup wizard before the user has an account.
// Returns just the zone name and pickup days; no PII, no ZIP roster.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const zip = (url.searchParams.get('zip') ?? '').trim();
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'invalid_zip' }, { status: 400 });
  }

  const snap = await adminDb
    .collection('zones')
    .where('zipCodes', 'array-contains', zip)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ inService: false });
  }

  const zone = snap.docs[0].data() as Partial<ZoneDoc> & { pickupDayOfWeek?: number };
  return NextResponse.json({
    inService: true,
    zoneName: typeof zone.name === 'string' ? zone.name : null,
    pickupDaysOfWeek: resolvePickupDays(zone),
  });
}
