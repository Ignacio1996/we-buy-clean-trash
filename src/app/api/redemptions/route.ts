import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import {
  REDEMPTION_BRANDS,
  type RedemptionBrand,
  type RedemptionDoc,
} from '@/lib/types/redemption';

export const runtime = 'nodejs';

const ACTIVE_BRANDS: RedemptionBrand[] = ['amazon', 'walmart'];
const GIFT_CARD_POINTS = 1_000;
// Pilot marketing budget: $10 gift card × 100 users = $1,000.
// One redemption per resident, hard cap on total at 100.
export const PILOT_GIFT_CARD_CAP = 100;

function isBrand(value: unknown): value is RedemptionBrand {
  return typeof value === 'string' && (REDEMPTION_BRANDS as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'resident') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const raw = (json ?? {}) as Record<string, unknown>;
  const brand = isBrand(raw.brand) ? raw.brand : null;
  if (!brand || !ACTIVE_BRANDS.includes(brand)) {
    return NextResponse.json({ error: 'invalid_brand' }, { status: 400 });
  }
  const pointsSpent = GIFT_CARD_POINTS;

  // Pilot gating runs OUTSIDE the transaction (Firestore transactions can't run
  // queries, only doc gets). Concurrent requests at exactly the cap could each
  // pass this check before either commits — acceptable at pilot scale; revisit
  // when we open to a wider audience.
  const [existingForUserSnap, totalSnap] = await Promise.all([
    adminDb
      .collection('redemptions')
      .where('userId', '==', session.uid)
      .where('status', 'in', ['pending', 'fulfilled'])
      .limit(1)
      .get(),
    adminDb
      .collection('redemptions')
      .where('status', 'in', ['pending', 'fulfilled'])
      .count()
      .get(),
  ]);
  if (!existingForUserSnap.empty) {
    return NextResponse.json({ error: 'already_redeemed_pilot' }, { status: 403 });
  }
  if (totalSnap.data().count >= PILOT_GIFT_CARD_CAP) {
    return NextResponse.json({ error: 'pilot_cap_reached' }, { status: 403 });
  }

  const userRef = adminDb.collection('users').doc(session.uid);
  const redemptionRef = adminDb.collection('redemptions').doc();
  const transactionRef = adminDb.collection('transactions').doc();

  const result = await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { error: 'user_not_found', status: 404 } as const;
    const balance =
      typeof userSnap.get('pointsBalance') === 'number'
        ? (userSnap.get('pointsBalance') as number)
        : 0;
    if (balance < pointsSpent) {
      return { error: 'insufficient_balance', status: 402 } as const;
    }
    const balanceAfter = balance - pointsSpent;
    const dollarValue = pointsToDollars(pointsSpent);

    const redemption: RedemptionDoc = {
      id: redemptionRef.id,
      userId: session.uid,
      brand,
      pointsSpent,
      dollarValue,
      status: 'pending',
      fulfillmentCode: null,
      fulfilledBy: null,
      fulfilledAt: null,
      createdAt: FieldValue.serverTimestamp() as unknown as RedemptionDoc['createdAt'],
    };
    tx.set(redemptionRef, redemption);
    tx.update(userRef, {
      pointsBalance: balanceAfter,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(transactionRef, {
      id: transactionRef.id,
      userId: session.uid,
      type: 'redemption',
      pointsDelta: -pointsSpent,
      balanceAfter,
      relatedDocId: redemptionRef.id,
      description: `${brand === 'amazon' ? 'Amazon' : 'Walmart'} gift card — $${dollarValue.toFixed(2)}`,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, balanceAfter, dollarValue } as const;
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    balanceAfter: result.balanceAfter,
    dollarValue: result.dollarValue,
  });
}
