import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import type { BagProcessingDoc } from '@/lib/types/bagProcessing';
import type { ContaminationSeverity } from '@/lib/types/material';
import type { PickupDoc } from '@/lib/types/pickup';
import type { UserDoc } from '@/lib/types/user';
import type { ZoneDoc } from '@/lib/types/zone';

export interface ZonePerformanceRow {
  zoneId: string;
  zoneName: string;
  residents: number;
  bags: number;
  weightLbs: number;
  revenueCents: number;
}

export interface ContaminationAlert {
  residentId: string;
  residentName: string;
  addressLine: string | null;
  zoneName: string | null;
  strikeCount: number;
  lastSeverity: ContaminationSeverity;
  lastAt: Date;
}

export interface OperatorLeaderboardRow {
  operatorId: string;
  operatorName: string;
  completed: number;
  issues: number;
}

const STRIKE_WINDOW_DAYS = 180;

function startOfMonth(): Timestamp {
  const now = new Date();
  return Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function strikeWindowStart(): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - STRIKE_WINDOW_DAYS);
  return Timestamp.fromDate(d);
}

export async function loadZonePerformance(): Promise<ZonePerformanceRow[]> {
  const monthStart = startOfMonth();

  const [zonesSnap, residentsSnap, processingSnap, ordersSnap] = await Promise.all([
    adminDb.collection('zones').orderBy('name').get(),
    adminDb.collection('users').where('role', '==', 'resident').get(),
    adminDb.collection('bagProcessing').where('createdAt', '>=', monthStart).get(),
    adminDb.collection('bagOrders').where('createdAt', '>=', monthStart).get(),
  ]);

  const zones = zonesSnap.docs.map((d) => d.data() as ZoneDoc);
  const residentZone = new Map<string, string | null>();
  const residentCountByZone = new Map<string, number>();
  residentsSnap.docs.forEach((d) => {
    const u = d.data() as UserDoc;
    residentZone.set(u.uid, u.zoneId ?? null);
    if (u.zoneId) {
      residentCountByZone.set(u.zoneId, (residentCountByZone.get(u.zoneId) ?? 0) + 1);
    }
  });

  const bagsByZone = new Map<string, number>();
  const weightByZone = new Map<string, number>();
  processingSnap.docs.forEach((d) => {
    const doc = d.data() as BagProcessingDoc;
    const zoneId = residentZone.get(doc.residentId);
    if (!zoneId) return;
    bagsByZone.set(zoneId, (bagsByZone.get(zoneId) ?? 0) + 1);
    const totalLbs = Object.values(doc.weights ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    weightByZone.set(zoneId, (weightByZone.get(zoneId) ?? 0) + totalLbs);
  });

  const revenueByZone = new Map<string, number>();
  ordersSnap.docs.forEach((d) => {
    const o = d.data() as BagOrderDoc;
    if (o.status === 'cancelled') return;
    const zoneId = o.zoneId ?? residentZone.get(o.residentId) ?? null;
    if (!zoneId) return;
    revenueByZone.set(zoneId, (revenueByZone.get(zoneId) ?? 0) + (o.total ?? 0));
  });

  return zones.map((z) => ({
    zoneId: z.id,
    zoneName: z.name,
    residents: residentCountByZone.get(z.id) ?? 0,
    bags: bagsByZone.get(z.id) ?? 0,
    weightLbs: weightByZone.get(z.id) ?? 0,
    revenueCents: Math.round((revenueByZone.get(z.id) ?? 0) * 100),
  }));
}

export async function loadContaminationAlerts(limit = 8): Promise<ContaminationAlert[]> {
  const windowStart = strikeWindowStart();
  const snap = await adminDb
    .collection('bagProcessing')
    .where('createdAt', '>=', windowStart)
    .get();

  const byResident = new Map<
    string,
    { count: number; lastAt: Date; lastSeverity: ContaminationSeverity }
  >();
  snap.docs.forEach((d) => {
    const doc = d.data() as BagProcessingDoc;
    if (!doc.contaminationSeverity || doc.contaminationSeverity === 'none') return;
    const createdAt = doc.createdAt?.toDate?.() ?? new Date();
    const prev = byResident.get(doc.residentId);
    if (prev) {
      prev.count += 1;
      if (createdAt > prev.lastAt) {
        prev.lastAt = createdAt;
        prev.lastSeverity = doc.contaminationSeverity;
      }
    } else {
      byResident.set(doc.residentId, {
        count: 1,
        lastAt: createdAt,
        lastSeverity: doc.contaminationSeverity,
      });
    }
  });

  const top = Array.from(byResident.entries())
    .sort((a, b) => b[1].count - a[1].count || b[1].lastAt.getTime() - a[1].lastAt.getTime())
    .slice(0, limit);

  if (top.length === 0) return [];

  const residentRefs = top.map(([uid]) => adminDb.collection('users').doc(uid));
  const residentSnaps = await adminDb.getAll(...residentRefs);
  const residents = new Map<string, UserDoc>();
  residentSnaps.forEach((s) => {
    if (s.exists) residents.set(s.id, s.data() as UserDoc);
  });

  const addressIds = Array.from(residents.values())
    .map((r) => r.addressId)
    .filter((id): id is string => !!id);
  const addressSnaps =
    addressIds.length > 0
      ? await adminDb.getAll(...addressIds.map((id) => adminDb.collection('addresses').doc(id)))
      : [];
  const addresses = new Map<string, { street: string; unit: string | null; city: string }>();
  addressSnaps.forEach((s) => {
    if (s.exists) {
      const a = s.data() as { street: string; unit: string | null; city: string };
      addresses.set(s.id, { street: a.street, unit: a.unit ?? null, city: a.city });
    }
  });

  const zoneIds = Array.from(
    new Set(
      Array.from(residents.values())
        .map((r) => r.zoneId)
        .filter((id): id is string => !!id),
    ),
  );
  const zoneSnaps =
    zoneIds.length > 0
      ? await adminDb.getAll(...zoneIds.map((id) => adminDb.collection('zones').doc(id)))
      : [];
  const zones = new Map<string, string>();
  zoneSnaps.forEach((s) => {
    if (s.exists) zones.set(s.id, (s.data() as ZoneDoc).name);
  });

  return top.map(([uid, info]) => {
    const resident = residents.get(uid);
    const address = resident?.addressId ? addresses.get(resident.addressId) : null;
    const addressLine = address
      ? `${address.street}${address.unit ? ` #${address.unit}` : ''}`
      : null;
    return {
      residentId: uid,
      residentName: resident?.name ?? 'Unknown resident',
      addressLine,
      zoneName: resident?.zoneId ? (zones.get(resident.zoneId) ?? null) : null,
      strikeCount: info.count,
      lastSeverity: info.lastSeverity,
      lastAt: info.lastAt,
    };
  });
}

export async function loadOperatorLeaderboard(limit = 5): Promise<OperatorLeaderboardRow[]> {
  const monthStart = startOfMonth();
  const snap = await adminDb.collection('pickups').where('createdAt', '>=', monthStart).get();

  const byOperator = new Map<string, { completed: number; issues: number }>();
  snap.docs.forEach((d) => {
    const doc = d.data() as PickupDoc;
    if (!doc.operatorId) return;
    const row = byOperator.get(doc.operatorId) ?? { completed: 0, issues: 0 };
    if (doc.status === 'completed') row.completed += 1;
    if (doc.status === 'issue' || doc.status === 'skipped' || doc.status === 'missed') {
      row.issues += 1;
    }
    byOperator.set(doc.operatorId, row);
  });

  const top = Array.from(byOperator.entries())
    .sort((a, b) => b[1].completed - a[1].completed || a[1].issues - b[1].issues)
    .slice(0, limit);

  if (top.length === 0) return [];

  const operatorSnaps = await adminDb.getAll(
    ...top.map(([uid]) => adminDb.collection('users').doc(uid)),
  );
  const names = new Map<string, string>();
  operatorSnaps.forEach((s) => {
    if (s.exists) names.set(s.id, (s.data() as UserDoc).name);
  });

  return top.map(([uid, stats]) => ({
    operatorId: uid,
    operatorName: names.get(uid) ?? 'Unknown operator',
    completed: stats.completed,
    issues: stats.issues,
  }));
}
