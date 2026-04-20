import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import {
  MATERIAL_IDS,
  MATERIAL_DISPLAY_NAMES,
  isMaterialId,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';

export const runtime = 'nodejs';

function parsePrice(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
function parsePct(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

export async function PUT(request: Request) {
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
  const raw = (json ?? {}) as Record<string, unknown>;
  const entries = (raw.materials ?? {}) as Record<string, unknown>;

  const snapshot = {} as Record<MaterialId, MaterialPricing>;
  for (const id of MATERIAL_IDS) {
    const entry = entries[id] as Record<string, unknown> | undefined;
    if (!entry) {
      return NextResponse.json({ error: `missing_${id}` }, { status: 400 });
    }
    const marketPrice = parsePrice(entry.marketPrice);
    const customerPct = parsePct(entry.customerPct);
    if (marketPrice === null || customerPct === null) {
      return NextResponse.json({ error: `invalid_${id}` }, { status: 400 });
    }
    snapshot[id] = { marketPrice, customerPct };
  }

  // Sanity: reject unknown keys to catch typos.
  for (const key of Object.keys(entries)) {
    if (!isMaterialId(key)) {
      return NextResponse.json({ error: `unknown_material_${key}` }, { status: 400 });
    }
  }

  const priceHistoryRef = adminDb.collection('priceHistory').doc();
  await adminDb.runTransaction(async (tx) => {
    for (const id of MATERIAL_IDS) {
      const ref = adminDb.collection('materials').doc(id);
      tx.set(
        ref,
        {
          id,
          name: MATERIAL_DISPLAY_NAMES[id],
          marketPrice: snapshot[id].marketPrice,
          customerPct: snapshot[id].customerPct,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        },
        { merge: true },
      );
    }
    tx.set(priceHistoryRef, {
      id: priceHistoryRef.id,
      snapshot,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: session.uid,
    });
  });

  return NextResponse.json({ ok: true });
}
