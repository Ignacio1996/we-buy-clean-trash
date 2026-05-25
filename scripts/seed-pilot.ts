import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { UserRecord } from 'firebase-admin/auth';
import { adminAuth, adminDb } from './_admin';
import type { Role } from '../src/lib/types/role';
import { MATERIAL_IDS } from '../src/lib/types/material';

// Idempotent pilot seed — safe to re-run. Creates the reference state the
// build plan calls for:
//   · 1 zone (Kirk pilot)
//   · 1 depot linked to that zone
//   · 1 admin (defaults to Nicolas's email; override with $ADMIN_EMAIL)
//   · 1 operator
//   · 1 depot_worker
//   · 5 residents with addresses
//
// Existing docs are preserved — we only backfill missing fields and ensure
// custom claims match. The script never touches `pointsBalance`, `transactions`,
// `inventory`, or any other ledger state for existing residents.

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'tia.admin@wbct-pilot.test';
const TEST_PASSWORD = process.env.PILOT_TEST_PASSWORD ?? 'webuycleantrash';

const ZONE_ID = 'kirk-pilot';
const DEPOT_ID = 'kirk-depot';
const SIGNUP_BONUS_POINTS = 100;

const ZONE = {
  id: ZONE_ID,
  name: 'Kirk pilot',
  depotId: DEPOT_ID,
  pickupDaysOfWeek: [3], // Wednesday
  zipCodes: ['80301'],
};

const DEPOT = {
  id: DEPOT_ID,
  name: 'Kirk Depot',
  street: '2850 Iris Ave',
  city: 'Boulder',
  state: 'CO',
  postalCode: '80301',
  geo: { lat: 40.0435, lng: -105.2467 },
  zoneIds: [ZONE_ID],
  acceptedMaterials: [...MATERIAL_IDS],
};

interface TestUser {
  key: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  zoneId: string | null;
  depotId: string | null;
  address: {
    street: string;
    unit: string | null;
    city: string;
    state: string;
    postalCode: string;
    geo: { lat: number; lng: number };
  } | null;
}

const TEST_USERS: TestUser[] = [
  {
    key: 'operator',
    email: 'operator.test@webuyclean.trash',
    name: 'Aguirre Operator',
    phone: '+15555550101',
    role: 'operator',
    zoneId: ZONE_ID,
    depotId: DEPOT_ID,
    address: null,
  },
  {
    key: 'depot_worker',
    email: 'depot.test@webuyclean.trash',
    name: 'Goode Depot',
    phone: '+15555550102',
    role: 'depot_worker',
    zoneId: ZONE_ID,
    depotId: DEPOT_ID,
    address: null,
  },
  ...[
    { street: '1120 Pearl St', name: 'Casey Pearl' },
    { street: '2245 Broadway', name: 'Devon Broadway' },
    { street: '3378 Iris Ave', name: 'Eden Iris' },
    { street: '1456 Spruce St', name: 'Frankie Spruce' },
    { street: '2002 Folsom St', name: 'Greer Folsom' },
  ].map<TestUser>((r, i) => ({
    key: `resident_${i + 1}`,
    email: `resident${i + 1}.test@webuyclean.trash`,
    name: r.name,
    phone: `+1555555020${i + 1}`,
    role: 'resident',
    zoneId: ZONE_ID,
    depotId: null,
    address: {
      street: r.street,
      unit: null,
      city: 'Boulder',
      state: 'CO',
      postalCode: '80301',
      geo: { lat: 40.0435 + i * 0.002, lng: -105.2467 + i * 0.002 },
    },
  })),
];

async function upsertZone() {
  const ref = adminDb.collection('zones').doc(ZONE_ID);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`· zones/${ZONE_ID} exists`);
    return;
  }
  await ref.set({ ...ZONE, createdAt: FieldValue.serverTimestamp() });
  console.log(`✓ created zones/${ZONE_ID}`);
}

async function upsertDepot() {
  const ref = adminDb.collection('depots').doc(DEPOT_ID);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`· depots/${DEPOT_ID} exists`);
    return;
  }
  await ref.set({
    ...DEPOT,
    managerId: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ created depots/${DEPOT_ID}`);
}

async function ensureAuthUser(email: string, name: string): Promise<UserRecord> {
  try {
    return await adminAuth.getUserByEmail(email);
  } catch {
    return adminAuth.createUser({
      email,
      password: TEST_PASSWORD,
      displayName: name,
      emailVerified: true,
    });
  }
}

async function ensureAdmin() {
  let auth: UserRecord;
  try {
    auth = await adminAuth.getUserByEmail(ADMIN_EMAIL);
  } catch {
    console.log(
      `⚠ admin email ${ADMIN_EMAIL} not found in Firebase Auth — skip (sign in once, then re-run)`,
    );
    return;
  }

  const existingClaims = (auth.customClaims ?? {}) as { role?: string };
  if (existingClaims.role !== 'admin') {
    await adminAuth.setCustomUserClaims(auth.uid, { role: 'admin' });
    console.log(`✓ set role=admin claim on ${ADMIN_EMAIL}`);
  }

  const ref = adminDb.collection('users').doc(auth.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid: auth.uid,
      email: auth.email ?? ADMIN_EMAIL,
      name: auth.displayName ?? 'Admin',
      phone: null,
      role: 'admin',
      zoneId: null,
      addressId: null,
      depotId: null,
      pointsBalance: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ created users/${auth.uid} (admin)`);
  } else if (snap.get('role') !== 'admin') {
    await ref.update({ role: 'admin', updatedAt: FieldValue.serverTimestamp() });
    console.log(`✓ promoted users/${auth.uid} role → admin`);
  } else {
    console.log(`· admin users/${auth.uid} already wired`);
  }
}

async function ensureTestUser(u: TestUser) {
  const auth = await ensureAuthUser(u.email, u.name);
  const existingClaims = (auth.customClaims ?? {}) as { role?: string };
  if (existingClaims.role !== u.role) {
    await adminAuth.setCustomUserClaims(auth.uid, { role: u.role });
    console.log(`✓ claim role=${u.role} on ${u.email}`);
  }

  const userRef = adminDb.collection('users').doc(auth.uid);
  const userSnap = await userRef.get();

  // Residents need an address doc before the users doc so addressId resolves.
  let addressId: string | null = userSnap.get('addressId') ?? null;
  if (u.address && !addressId) {
    const addressRef = adminDb.collection('addresses').doc();
    await addressRef.set({
      id: addressRef.id,
      residentId: auth.uid,
      street: u.address.street,
      unit: u.address.unit,
      city: u.address.city,
      state: u.address.state,
      postalCode: u.address.postalCode,
      geo: u.address.geo,
      zoneId: u.zoneId,
      createdAt: FieldValue.serverTimestamp(),
    });
    addressId = addressRef.id;
    console.log(`✓ created addresses/${addressId} for ${u.email}`);
  }

  if (!userSnap.exists) {
    await userRef.set({
      uid: auth.uid,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      zoneId: u.zoneId,
      addressId,
      depotId: u.depotId,
      pointsBalance: u.role === 'resident' ? SIGNUP_BONUS_POINTS : 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ created users/${auth.uid} (${u.role}) — ${u.email}`);

    if (u.role === 'resident') {
      const txRef = adminDb.collection('transactions').doc();
      await txRef.set({
        id: txRef.id,
        userId: auth.uid,
        type: 'signup_bonus',
        pointsDelta: SIGNUP_BONUS_POINTS,
        balanceAfter: SIGNUP_BONUS_POINTS,
        relatedDocId: null,
        description: 'Welcome bonus',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } else {
    console.log(`· users/${auth.uid} exists — ${u.email}`);
  }
}

async function main() {
  const t0 = Timestamp.now();

  console.log('— pilot seed starting —');
  console.log(`project: ${process.env.FIREBASE_ADMIN_SA ? 'via service account' : 'default'}`);
  console.log(`admin email: ${ADMIN_EMAIL}`);
  console.log(`test password: ${TEST_PASSWORD}`);
  console.log('');

  await upsertZone();
  await upsertDepot();
  await ensureAdmin();

  for (const u of TEST_USERS) {
    await ensureTestUser(u);
  }

  console.log('');
  console.log(`✓ seed complete in ${Date.now() - t0.toMillis()}ms`);
  console.log('');
  console.log('Test accounts (password shown above):');
  for (const u of TEST_USERS) {
    console.log(`  ${u.role.padEnd(14)} ${u.email}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
