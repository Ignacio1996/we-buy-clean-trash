import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isComplianceNoticeType } from '@/lib/types/complianceNotice';
import type { ComplianceBatchDoc } from '@/lib/types/complianceBatch';
import type { ZoneDoc } from '@/lib/types/zone';

export const runtime = 'nodejs';

interface GeneratePayload {
  zoneId: string;
  type: 'initial_service' | 'semi_annual';
  notes: string | null;
}

function parseGenerate(raw: unknown): GeneratePayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const r = raw as Record<string, unknown>;
  const zoneId = typeof r.zoneId === 'string' ? r.zoneId.trim() : '';
  if (!zoneId) return { error: 'invalid_zone_id' };
  if (!isComplianceNoticeType(r.type)) return { error: 'invalid_type' };
  const notesRaw = typeof r.notes === 'string' ? r.notes.trim() : '';
  const notes = notesRaw ? notesRaw.slice(0, 500) : null;
  return { zoneId, type: r.type, notes };
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
  const parsed = parseGenerate(json);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const [zoneSnap, residentsSnap] = await Promise.all([
    adminDb.collection('zones').doc(parsed.zoneId).get(),
    adminDb
      .collection('users')
      .where('role', '==', 'resident')
      .where('zoneId', '==', parsed.zoneId)
      .get(),
  ]);
  if (!zoneSnap.exists) return NextResponse.json({ error: 'zone_not_found' }, { status: 404 });

  const zone = zoneSnap.data() as ZoneDoc;
  const allResidentIds = residentsSnap.docs.map((d) => d.id);

  // Initial-service notices skip residents whose service has already started
  // (i.e. they have at least one completed pickup). Semi-annual goes to everyone.
  const startedIds =
    parsed.type === 'initial_service' && allResidentIds.length > 0
      ? await loadResidentsWithStartedService(allResidentIds)
      : new Set<string>();

  const residentIds = allResidentIds.filter((id) => !startedIds.has(id));
  const excludedActiveResidents = allResidentIds.length - residentIds.length;

  const ref = adminDb.collection('complianceBatches').doc();
  await ref.set({
    id: ref.id,
    zoneId: parsed.zoneId,
    zoneName: zone.name,
    type: parsed.type,
    residentCount: residentIds.length,
    residentIds,
    excludedActiveResidents,
    status: 'generated',
    generatedAt: FieldValue.serverTimestamp(),
    generatedBy: session.uid,
    mailedAt: null,
    mailedBy: null,
    notes: parsed.notes,
  });

  return NextResponse.json({ ok: true, id: ref.id, residentCount: residentIds.length });
}

async function loadResidentsWithStartedService(
  residentIds: string[],
): Promise<Set<string>> {
  // Firestore `in` queries cap at 30 values; chunk and run in parallel.
  const CHUNK = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < residentIds.length; i += CHUNK) {
    chunks.push(residentIds.slice(i, i + CHUNK));
  }
  const started = new Set<string>();
  await Promise.all(
    chunks.map(async (ids) => {
      const snap = await adminDb
        .collection('pickups')
        .where('residentId', 'in', ids)
        .where('status', '==', 'completed')
        .get();
      snap.docs.forEach((d) => {
        const rid = d.get('residentId');
        if (typeof rid === 'string') started.add(rid);
      });
    }),
  );
  return started;
}

interface PatchPayload {
  batchId: string;
  action: 'mark_mailed';
}

function parsePatch(raw: unknown): PatchPayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const r = raw as Record<string, unknown>;
  const batchId = typeof r.batchId === 'string' ? r.batchId.trim() : '';
  if (!batchId) return { error: 'invalid_batch_id' };
  if (r.action !== 'mark_mailed') return { error: 'invalid_action' };
  return { batchId, action: r.action };
}

export async function PATCH(request: Request) {
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
  const parsed = parsePatch(json);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const ref = adminDb.collection('complianceBatches').doc(parsed.batchId);
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('batch_not_found');
      const batch = snap.data() as ComplianceBatchDoc;
      if (batch.status !== 'generated') throw new Error('batch_not_updatable');
      tx.update(ref, {
        status: 'mailed',
        mailedAt: FieldValue.serverTimestamp(),
        mailedBy: session.uid,
      });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'compliance_update_failed';
    const status =
      msg === 'batch_not_found' ? 404 : msg === 'batch_not_updatable' ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
