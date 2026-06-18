import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { uploadPhoto } from '@/lib/storage/uploadPhoto';
import { isContaminationSeverity, type ContaminationSeverity } from '@/lib/types/material';
import { isCartStatus, type CartStatus } from '@/lib/types/siteCheck';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';

const MAX_PHOTO_BASE64 = 6 * 1024 * 1024;

interface SiteCheckPayload {
  commercialAccountId: string;
  cartStatus: CartStatus;
  contaminationSeverity: ContaminationSeverity;
  overflow: boolean;
  driverNotes: string | null;
  photoBase64: string | null;
  photoMime: string;
}

function parsePayload(raw: unknown): SiteCheckPayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const r = raw as Record<string, unknown>;

  const commercialAccountId =
    typeof r.commercialAccountId === 'string' ? r.commercialAccountId.trim() : '';
  if (!commercialAccountId) return { error: 'invalid_account_id' };

  if (!isCartStatus(r.cartStatus)) return { error: 'invalid_cart_status' };
  if (!isContaminationSeverity(r.contaminationSeverity)) {
    return { error: 'invalid_contamination' };
  }

  const driverNotes =
    typeof r.driverNotes === 'string' && r.driverNotes.trim() ? r.driverNotes.trim() : null;
  const photoBase64 =
    typeof r.photoBase64 === 'string' && r.photoBase64.trim() ? r.photoBase64 : null;
  if (photoBase64 && photoBase64.length > MAX_PHOTO_BASE64) {
    return { error: 'photo_too_large' };
  }
  const photoMime = typeof r.photoMime === 'string' ? r.photoMime : 'image/jpeg';

  return {
    commercialAccountId,
    cartStatus: r.cartStatus,
    contaminationSeverity: r.contaminationSeverity,
    overflow: r.overflow === true,
    driverNotes,
    photoBase64,
    photoMime,
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'operator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = parsePayload(json);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const accountSnap = await adminDb
    .collection('commercialAccounts')
    .doc(parsed.commercialAccountId)
    .get();
  if (!accountSnap.exists) {
    return NextResponse.json({ error: 'account_not_found' }, { status: 404 });
  }
  const account = accountSnap.data() as CommercialAccountDoc;
  if (account.active === false) {
    return NextResponse.json({ error: 'account_inactive' }, { status: 409 });
  }

  const checkRef = adminDb.collection('siteChecks').doc();

  let photoUrl: string | null = null;
  if (parsed.photoBase64) {
    const upload = await uploadPhoto({
      path: `siteChecks/${parsed.commercialAccountId}/${checkRef.id}.jpg`,
      base64: parsed.photoBase64,
      contentType: parsed.photoMime,
    });
    photoUrl = upload.url;
  }

  // Attach to the operator's open run, if any (same convention as bin pickups).
  let routeId: string | null = null;
  const openRouteSnap = await adminDb
    .collection('compostRoutes')
    .where('operatorId', '==', session.uid)
    .where('status', '==', 'in_progress')
    .limit(1)
    .get();
  if (!openRouteSnap.empty) routeId = openRouteSnap.docs[0].id;

  await checkRef.set({
    id: checkRef.id,
    commercialAccountId: parsed.commercialAccountId,
    zoneId: account.zoneId,
    operatorId: session.uid,
    routeId,
    cartStatus: parsed.cartStatus,
    contaminationSeverity: parsed.contaminationSeverity,
    overflow: parsed.overflow,
    driverNotes: parsed.driverNotes,
    photoUrl,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, siteCheckId: checkRef.id });
}
