import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isMaterialId, type MaterialId } from '@/lib/types/material';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const depotRef = adminDb.collection('depots').doc(id);
  const depotSnap = await depotRef.get();
  if (!depotSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const zonesSnap = await adminDb.collection('zones').where('depotId', '==', id).limit(1).get();
  if (!zonesSnap.empty) {
    return NextResponse.json({ error: 'depot_has_zones' }, { status: 409 });
  }

  await depotRef.delete();
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (Array.isArray(raw.acceptedMaterials)) {
    // Validate against the live materials collection so newly-added custom
    // materials (compost, textiles, electronics, etc.) are accepted as valid.
    const materialsSnap = await adminDb.collection('materials').get();
    const validIds = new Set<MaterialId>();
    for (const doc of materialsSnap.docs) {
      if (isMaterialId(doc.id)) validIds.add(doc.id);
    }
    const accepted: MaterialId[] = [];
    for (const v of raw.acceptedMaterials) {
      if (!isMaterialId(v) || !validIds.has(v)) {
        return NextResponse.json({ error: 'invalid_material' }, { status: 400 });
      }
      if (!accepted.includes(v)) accepted.push(v);
    }
    if (accepted.length === 0) {
      return NextResponse.json({ error: 'must_accept_at_least_one' }, { status: 400 });
    }
    update.acceptedMaterials = accepted;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const ref = adminDb.collection('depots').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await ref.update(update);
  return NextResponse.json({ ok: true });
}
