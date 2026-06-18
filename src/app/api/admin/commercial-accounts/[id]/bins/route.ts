import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isBinSize, type BinSize } from '@/lib/logic/binWeightTable';
import type { ContainerType } from '@/lib/types/bag';
import { isCompostManagerRole } from '@/lib/types/role';

const BIN_NUMBER_MIN = 1000;
const BIN_NUMBER_MAX = 9999;
const MAX_COLLISION_RETRIES = 12;
const MAX_BINS_PER_REQUEST = 50;

function binSizeToContainer(size: BinSize): ContainerType {
  if (size === '32') return 'bin_32';
  if (size === '48') return 'bin_48';
  return 'bin_64';
}

function randomBinNumber(): string {
  const n = Math.floor(Math.random() * (BIN_NUMBER_MAX - BIN_NUMBER_MIN + 1)) + BIN_NUMBER_MIN;
  return String(n);
}

async function reserveBinCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
    const candidate = `BIN-${randomBinNumber()}`;
    const existing = await adminDb
      .collection('bags')
      .where('qrCode', '==', candidate)
      .limit(1)
      .get();
    if (existing.empty) return candidate;
  }
  throw new Error('bin_number_exhausted');
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isCompostManagerRole(session.role)) {
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

  if (!isBinSize(raw.binSize)) {
    return NextResponse.json({ error: 'invalid_bin_size' }, { status: 400 });
  }
  const count = typeof raw.count === 'number' ? raw.count : Number(raw.count);
  if (!Number.isFinite(count) || count < 1 || count > MAX_BINS_PER_REQUEST) {
    return NextResponse.json({ error: 'invalid_count' }, { status: 400 });
  }

  const accountRef = adminDb.collection('commercialAccounts').doc(id);
  const accountSnap = await accountRef.get();
  if (!accountSnap.exists) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });
  if (accountSnap.get('active') === false) {
    return NextResponse.json({ error: 'account_inactive' }, { status: 409 });
  }

  const containerType = binSizeToContainer(raw.binSize as BinSize);

  // Reserve all bin codes up-front so the transaction is fast and we don't
  // hold contended reads. Each bin is its own BagDoc with reusable=true.
  const codes: string[] = [];
  try {
    for (let i = 0; i < count; i += 1) {
      codes.push(await reserveBinCode());
    }
  } catch {
    return NextResponse.json({ error: 'bin_number_exhausted' }, { status: 503 });
  }

  const bagRefs = codes.map(() => adminDb.collection('bags').doc());

  await adminDb.runTransaction(async (tx) => {
    for (let i = 0; i < bagRefs.length; i += 1) {
      tx.set(bagRefs[i], {
        id: bagRefs[i].id,
        qrCode: codes[i],
        printedNumber: codes[i],
        // Bins are not part of the residential 10-pack sticker-sheet model — store
        // a marker on the field so legacy code that reads stickerSheetId still works.
        stickerSheetId: `commercial:${id}`,
        residentId: null,
        commercialAccountId: id,
        declaredType: null,
        status: 'unused',
        containerType,
        reusable: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return NextResponse.json({
    ok: true,
    bagIds: bagRefs.map((r) => r.id),
    codes,
  });
}
