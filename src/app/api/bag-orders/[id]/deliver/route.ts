import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { BagOrderDoc } from '@/lib/types/bagOrder';

export const runtime = 'nodejs';

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

function bagCode(sheetNumber: string, index: number): string {
  return `BAG-${sheetNumber}-${String(index).padStart(2, '0')}`;
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

  // Collision check: a sheet with the same number from a prior delivery would create
  // duplicate bag codes. Keep this simple at pilot scale — just probe the first bag.
  const firstCode = bagCode(anchor.sheetNumber, 1);
  const collision = await adminDb
    .collection('bags')
    .where('qrCode', '==', firstCode)
    .limit(1)
    .get();
  if (!collision.empty) {
    return NextResponse.json({ error: 'sheet_already_issued' }, { status: 409 });
  }

  const sheetRef = adminDb.collection('stickerSheets').doc();
  const bagRefs = Array.from({ length: 10 }, () => adminDb.collection('bags').doc());

  await adminDb.runTransaction(async (tx) => {
    const freshOrder = await tx.get(orderRef);
    if (!freshOrder.exists || freshOrder.get('status') === 'delivered') {
      throw new Error('order_state_changed');
    }
    for (let i = 0; i < bagRefs.length; i += 1) {
      const code = bagCode(anchor.sheetNumber, i + 1);
      tx.set(bagRefs[i], {
        id: bagRefs[i].id,
        qrCode: code,
        printedNumber: code,
        stickerSheetId: sheetRef.id,
        residentId: order.residentId,
        declaredType: null,
        status: 'unused',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(sheetRef, {
      id: sheetRef.id,
      residentId: order.residentId,
      bagIds: bagRefs.map((r) => r.id),
      bagOrderId: orderRef.id,
      printedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(orderRef, {
      status: 'delivered',
      deliveredAt: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({
    ok: true,
    stickerSheetId: sheetRef.id,
    bagIds: bagRefs.map((r) => r.id),
  });
}
