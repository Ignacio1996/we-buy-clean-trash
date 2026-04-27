import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { uploadPhoto } from '@/lib/storage/uploadPhoto';
import { getSession } from '@/lib/auth/session';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { PickupDoc } from '@/lib/types/pickup';

export const runtime = 'nodejs';

const MAX_BASE64_CHARS = 6 * 1024 * 1024;

interface CompletePayload {
  sealed: boolean;
  contaminationObserved: boolean;
  photoBase64: string;
  photoMime: string;
}

function parsePayload(raw: unknown): CompletePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const sealed = typeof r.sealed === 'boolean' ? r.sealed : null;
  const contaminationObserved =
    typeof r.contaminationObserved === 'boolean' ? r.contaminationObserved : null;
  const photoBase64 = typeof r.photoBase64 === 'string' ? r.photoBase64 : '';
  const photoMime = typeof r.photoMime === 'string' ? r.photoMime : 'image/jpeg';
  if (sealed === null || contaminationObserved === null) return null;
  if (!photoBase64 || photoBase64.length > MAX_BASE64_CHARS) return null;
  return { sealed, contaminationObserved, photoBase64, photoMime };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const payload = parsePayload(json);
  if (!payload) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const pickupRef = adminDb.collection('pickups').doc(id);
  const pickupSnap = await pickupRef.get();
  if (!pickupSnap.exists) return NextResponse.json({ error: 'pickup_not_found' }, { status: 404 });
  const pickup = pickupSnap.data() as PickupDoc;
  if (pickup.status !== 'pending') {
    return NextResponse.json({ error: 'pickup_not_pending', status: pickup.status }, { status: 409 });
  }
  if (!pickup.routeId) {
    return NextResponse.json({ error: 'pickup_not_on_route' }, { status: 409 });
  }

  const routeResult = await loadOperatorRoute(session, pickup.routeId);
  if (!routeResult.ok) {
    return NextResponse.json({ error: routeResult.error }, { status: routeResult.status });
  }
  if (routeResult.context.route.status !== 'in_progress') {
    return NextResponse.json({ error: 'route_not_started' }, { status: 409 });
  }

  // Upload operator photo to its own path — keep doorstep photo untouched.
  const storagePath = `pickups/${pickup.residentId}/${pickup.id}-op.jpg`;
  const upload = await uploadPhoto({
    path: storagePath,
    base64: payload.photoBase64,
    contentType: payload.photoMime,
  });
  const operatorPhotoUrl = upload.url;

  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(pickupRef);
    if (!fresh.exists || fresh.get('status') !== 'pending') {
      throw new Error('pickup_state_changed');
    }
    tx.update(pickupRef, {
      status: 'completed',
      sealed: payload.sealed,
      operatorPhotoUrl,
      operatorId: session.uid,
      completedAt: FieldValue.serverTimestamp(),
      // If the operator flags contamination, we log it as an issue but still
      // mark pickup completed so the route can advance. Depot worker sets the
      // actual severity in Phase 7.
      issue: payload.contaminationObserved ? 'contaminated' : null,
    });
    tx.update(adminDb.collection('bags').doc(pickup.bagId), { status: 'picked_up' });
  });

  return NextResponse.json({ ok: true });
}
