import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { CAMPAIGNS_CACHE_TAG } from '@/lib/admin/loadActiveCampaigns';
import { isMaterialId, type MaterialId } from '@/lib/types/material';

interface CreatePayload {
  name: string;
  materialIds: MaterialId[];
  multiplier: number;
  startsAt: Date;
  endsAt: Date;
}

function parseCreate(raw: unknown): CreatePayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 80) : '';
  if (!name) return { error: 'invalid_name' };
  if (!Array.isArray(r.materialIds) || r.materialIds.length === 0) {
    return { error: 'invalid_material_ids' };
  }
  const materialIds: MaterialId[] = [];
  for (const v of r.materialIds) {
    if (!isMaterialId(v)) return { error: 'invalid_material_id' };
    if (!materialIds.includes(v)) materialIds.push(v);
  }
  const multiplier = Number(r.multiplier);
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 100) {
    return { error: 'invalid_multiplier' };
  }
  const startsAtMs = typeof r.startsAt === 'string' || typeof r.startsAt === 'number'
    ? new Date(r.startsAt).getTime()
    : NaN;
  const endsAtMs = typeof r.endsAt === 'string' || typeof r.endsAt === 'number'
    ? new Date(r.endsAt).getTime()
    : NaN;
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) {
    return { error: 'invalid_dates' };
  }
  if (endsAtMs <= startsAtMs) return { error: 'invalid_window' };
  return {
    name,
    materialIds,
    multiplier,
    startsAt: new Date(startsAtMs),
    endsAt: new Date(endsAtMs),
  };
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
  const parsed = parseCreate(json);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const ref = adminDb.collection('pricingCampaigns').doc();
  await ref.set({
    id: ref.id,
    name: parsed.name,
    materialIds: parsed.materialIds,
    multiplier: parsed.multiplier,
    startsAt: Timestamp.fromDate(parsed.startsAt),
    endsAt: Timestamp.fromDate(parsed.endsAt),
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: session.uid,
  });
  revalidateTag(CAMPAIGNS_CACHE_TAG, 'default');
  return NextResponse.json({ ok: true, id: ref.id });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const ref = adminDb.collection('pricingCampaigns').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  // Soft-end: flip active off and bring endsAt forward to now so it stops applying immediately.
  await ref.update({
    active: false,
    endsAt: FieldValue.serverTimestamp(),
  });
  revalidateTag(CAMPAIGNS_CACHE_TAG, 'default');
  return NextResponse.json({ ok: true });
}
