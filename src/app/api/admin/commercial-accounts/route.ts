import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { geocodeAddress } from '@/lib/maps/geocode';
import { isMaterialId, type MaterialId } from '@/lib/types/material';
import { isBinSize, type BinSize } from '@/lib/logic/binWeightTable';
import { normalizeCollectionDays, isSiteType } from '@/lib/types/commercialAccount';
import { isCompostManagerRole } from '@/lib/types/role';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

/**
 * Parses a "first month of data" input into a Timestamp pinned to the first of
 * that month (UTC). Accepts "YYYY-MM" (HTML month input) or any ISO date
 * string. Returns null for empty/invalid input.
 */
function monthStartOrNull(v: unknown): Timestamp | null {
  const s = str(v);
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return Timestamp.fromDate(new Date(Date.UTC(year, month - 1, 1)));
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isCompostManagerRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;

  const businessName = str(raw.businessName);
  const contactName = str(raw.contactName);
  const street = str(raw.street);
  const city = str(raw.city);
  const state = str(raw.state);
  const postalCode = str(raw.postalCode);
  const zoneId = str(raw.zoneId);
  if (!businessName || !contactName || !street || !city || !state || !postalCode || !zoneId) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const zoneSnap = await adminDb.collection('zones').doc(zoneId).get();
  if (!zoneSnap.exists) {
    return NextResponse.json({ error: 'zone_not_found' }, { status: 400 });
  }

  const defaultBinSize = raw.defaultBinSize;
  if (!isBinSize(defaultBinSize)) {
    return NextResponse.json({ error: 'invalid_bin_size' }, { status: 400 });
  }

  const pickupsPerWeek = num(raw.pickupsPerWeek);
  if (pickupsPerWeek === null || pickupsPerWeek < 1 || pickupsPerWeek > 7) {
    return NextResponse.json({ error: 'invalid_pickups_per_week' }, { status: 400 });
  }

  const binsOnSiteRaw = num(raw.binsOnSite);
  const binsOnSite = binsOnSiteRaw !== null && binsOnSiteRaw >= 0 ? Math.floor(binsOnSiteRaw) : 0;

  // Optional: bins currently operative (<= binsOnSite). Null means all operative.
  const operativeBinsRaw = num(raw.operativeBins);
  const operativeBins =
    operativeBinsRaw !== null && operativeBinsRaw >= 0
      ? Math.min(binsOnSite, Math.floor(operativeBinsRaw))
      : null;

  const collectionDays = normalizeCollectionDays(raw.collectionDays);
  if (!collectionDays) {
    return NextResponse.json({ error: 'invalid_collection_days' }, { status: 400 });
  }

  const routeOrderRaw = num(raw.routeOrder);
  const routeOrder =
    routeOrderRaw !== null && routeOrderRaw >= 0 ? Math.floor(routeOrderRaw) : null;

  if (!Array.isArray(raw.materialIds) || raw.materialIds.length === 0) {
    return NextResponse.json({ error: 'invalid_material_ids' }, { status: 400 });
  }
  const materialIds: MaterialId[] = [];
  for (const v of raw.materialIds) {
    if (!isMaterialId(v)) {
      return NextResponse.json({ error: 'invalid_material_ids' }, { status: 400 });
    }
    if (!materialIds.includes(v)) materialIds.push(v);
  }

  const result = await geocodeAddress({ street, unit: null, city, state, postalCode });
  const geo = result ? { lat: result.lat, lng: result.lng } : null;

  const ref = adminDb.collection('commercialAccounts').doc();
  await ref.set({
    id: ref.id,
    businessName,
    contactName,
    contactPhone: strOrNull(raw.contactPhone),
    contactEmail: strOrNull(raw.contactEmail),
    street,
    unit: strOrNull(raw.unit),
    city,
    state,
    postalCode,
    geo,
    zoneId,
    siteType: isSiteType(raw.siteType) ? raw.siteType : 'compost',
    defaultBinSize: defaultBinSize as BinSize,
    binsOnSite,
    operativeBins,
    pickupsPerWeek,
    collectionDays,
    routeOrder,
    affiliationId: strOrNull(raw.affiliationId),
    materialIds,
    firstMonthOfData: monthStartOrNull(raw.firstMonthOfData),
    active: true,
    status: 'active',
    driverNotes: strOrNull(raw.driverNotes),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, id: ref.id });
}
