import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { BagOrderDoc } from '@/lib/types/bagOrder';

// The operator scans ONE pre-printed sticker (e.g. "BAG-4237-01") to anchor
// the sheet. The server creates all 10 bag docs with sequential codes matching
// what's already printed on the physical sheet. Same pattern as scripts/dev-issue-bags.ts.
function parseAnchor(raw: string): { sheetNumber: string; startIndex: number } | null {
  const match = /^BAG-(\d{3,6})-(\d{2})$/.exec(raw.trim().toUpperCase());
  if (!match) return null;
  const sheetNumber = match[1];
  const startIndex = Number(match[2]);
  if (startIndex !== 1) return null; // pilot: stickers start at 01; reject mid-sheet anchors
  return { sheetNumber, startIndex };
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
  const raw = (json ?? {}) as Record<string, unknown>;
  const scannedCode = typeof raw.scannedCode === 'string' ? raw.scannedCode : '';
  const anchor = parseAnchor(scannedCode);
  if (!anchor) return NextResponse.json({ error: 'invalid_sticker' }, { status: 400 });

  const orderRef = adminDb.collection('bagOrders').doc(id);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  const order = orderSnap.data() as BagOrderDoc;
  if (order.status === 'delivered') {
    return NextResponse.json({ error: 'already_delivered' }, { status: 409 });
  }
  if (!order.deliveryRouteId) {
    return NextResponse.json({ error: 'order_not_on_route' }, { status: 409 });
  }

  const routeResult = await loadOperatorRoute(session, order.deliveryRouteId);
  if (!routeResult.ok) {
    return NextResponse.json({ error: routeResult.error }, { status: routeResult.status });
  }
  if (routeResult.context.route.status !== 'in_progress') {
    return NextResponse.json({ error: 'route_not_started' }, { status: 409 });
  }

  // Look up the pre-issued sheet by sheetNumber. Phase 10 flow: admin pre-prints
  // sticker sheets via /api/qr-sheet, which creates stickerSheets + 10 bag docs
  // with residentId=null. Delivery claims that sheet for this resident.
  const sheetQuery = await adminDb
    .collection('stickerSheets')
    .where('sheetNumber', '==', anchor.sheetNumber)
    .limit(1)
    .get();
  if (sheetQuery.empty) {
    return NextResponse.json({ error: 'sheet_not_pre_issued' }, { status: 404 });
  }
  const sheetDoc = sheetQuery.docs[0];
  const sheet = sheetDoc.data();
  if (sheet.residentId) {
    return NextResponse.json({ error: 'sheet_already_issued' }, { status: 409 });
  }
  const sheetRef = sheetDoc.ref;
  const bagIds: string[] = Array.isArray(sheet.bagIds) ? sheet.bagIds : [];
  if (bagIds.length !== 10) {
    return NextResponse.json({ error: 'sheet_bag_count_invalid' }, { status: 409 });
  }
  const bagRefs = bagIds.map((id) => adminDb.collection('bags').doc(id));

  await adminDb.runTransaction(async (tx) => {
    const freshOrder = await tx.get(orderRef);
    if (!freshOrder.exists || freshOrder.get('status') === 'delivered') {
      throw new Error('order_state_changed');
    }
    const freshSheet = await tx.get(sheetRef);
    if (!freshSheet.exists) throw new Error('sheet_not_pre_issued');
    if (freshSheet.get('residentId')) throw new Error('sheet_already_issued');

    for (const bagRef of bagRefs) {
      tx.update(bagRef, { residentId: order.residentId });
    }
    tx.update(sheetRef, {
      residentId: order.residentId,
      bagOrderId: orderRef.id,
      issuedAt: FieldValue.serverTimestamp(),
    });
    tx.update(orderRef, {
      status: 'delivered',
      deliveredAt: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({
    ok: true,
    stickerSheetId: sheetRef.id,
    bagIds,
  });
}
