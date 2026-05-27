import Link from 'next/link';
import { Timestamp } from 'firebase-admin/firestore';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadManagerDepots } from '@/lib/auth/managerAccess';
import {
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_IDS,
  type MaterialDoc,
  type MaterialId,
} from '@/lib/types/material';
import type { BagProcessingDoc } from '@/lib/types/bagProcessing';
import type { MillShipmentDoc } from '@/lib/types/millShipment';
import { PrintButton } from './PrintButton';

interface SearchParamsShape {
  month?: string;
}

interface PageProps {
  searchParams: Promise<SearchParamsShape>;
}

function parseMonth(raw: string | undefined): { year: number; month: number; label: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0-indexed
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number);
    if (y >= 2020 && m >= 1 && m <= 12) {
      year = y;
      month = m - 1;
    }
  }
  const label = new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return { year, month, label };
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month + delta, 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default async function ManagerReportsPage({ searchParams }: PageProps) {
  const session = await requireRole('depot_manager');
  const { month: monthParam } = await searchParams;
  const { year, month, label } = parseMonth(monthParam);

  const depots = await loadManagerDepots(session.uid);
  const depotIds = depots.map((d) => d.id);

  const monthStart = Timestamp.fromDate(new Date(Date.UTC(year, month, 1)));
  const monthEnd = Timestamp.fromDate(new Date(Date.UTC(year, month + 1, 1)));

  const aggregateWeights: Record<MaterialId, number> = {
    aluminum: 0,
    tin_steel: 0,
    cardboard: 0,
    paper: 0,
    pet: 0,
    hdpe: 0,
    mixed_plastic: 0,
  };
  let bagsProcessed = 0;
  let totalPointsAwarded = 0;
  let contaminatedBags = 0;
  const shipmentWeights: Record<MaterialId, number> = { ...aggregateWeights };
  let shipmentsCount = 0;

  if (depotIds.length > 0) {
    const bagProcessingSnaps = await Promise.all(
      depotIds.map((id) =>
        adminDb
          .collection('bagProcessing')
          .where('depotId', '==', id)
          .where('createdAt', '>=', monthStart)
          .where('createdAt', '<', monthEnd)
          .get(),
      ),
    );
    bagProcessingSnaps.forEach((snap) => {
      snap.docs.forEach((d) => {
        const doc = d.data() as BagProcessingDoc;
        bagsProcessed += 1;
        totalPointsAwarded += doc.pointsAwarded ?? 0;
        if (doc.contaminationSeverity && doc.contaminationSeverity !== 'none') {
          contaminatedBags += 1;
        }
        for (const id of MATERIAL_IDS) {
          aggregateWeights[id] += doc.weights?.[id] ?? 0;
        }
      });
    });

    const shipmentSnaps = await Promise.all(
      depotIds.map((id) =>
        adminDb
          .collection('millShipments')
          .where('depotId', '==', id)
          .where('createdAt', '>=', monthStart)
          .where('createdAt', '<', monthEnd)
          .get(),
      ),
    );
    shipmentSnaps.forEach((snap) => {
      snap.docs.forEach((d) => {
        const doc = d.data() as MillShipmentDoc;
        if (doc.status === 'cancelled') return;
        shipmentsCount += 1;
        for (const id of MATERIAL_IDS) {
          shipmentWeights[id] += doc.weights?.[id] ?? 0;
        }
      });
    });
  }

  const materialSnaps = await adminDb.getAll(
    ...MATERIAL_IDS.map((id) => adminDb.collection('materials').doc(id)),
  );
  const marketPrices = new Map<MaterialId, number>();
  materialSnaps.forEach((snap, i) => {
    if (snap.exists) marketPrices.set(MATERIAL_IDS[i], (snap.data() as MaterialDoc).marketPrice);
  });

  const totalWeightLbs = MATERIAL_IDS.reduce((a, id) => a + aggregateWeights[id], 0);
  const totalWeightTons = totalWeightLbs / 2000;
  const contaminationRate =
    bagsProcessed === 0 ? 0 : (contaminatedBags / bagsProcessed) * 100;
  const millRevenue = MATERIAL_IDS.reduce(
    (a, id) => a + (shipmentWeights[id] ?? 0) * (marketPrices.get(id) ?? 0),
    0,
  );

  return (
    <section className="mt-5 space-y-4 print:mt-0">
      <div className="print:hidden">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
          We Buy Clean Trash · Depot Mgr
        </div>
        <h1 className="mt-0.5 text-lg font-semibold text-white">Monthly report</h1>
        <div className="mt-1 flex items-center justify-between">
          <Link
            href={`/manager/reports?month=${shiftMonth(year, month, -1)}`}
            className="text-xs text-gray-400 underline hover:text-white"
          >
            ← Prev
          </Link>
          <div className="text-sm text-white">{label}</div>
          <Link
            href={`/manager/reports?month=${shiftMonth(year, month, 1)}`}
            className="text-xs text-gray-400 underline hover:text-white"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="hidden print:block">
        <div className="text-sm uppercase tracking-wide text-gray-600">
          We Buy Clean Trash · Monthly Report
        </div>
        <div className="mt-1 text-2xl font-semibold text-black">{label}</div>
        <div className="text-xs text-gray-600">
          Manager: {session.email ?? session.uid} · Depots:{' '}
          {depots.map((d) => d.name).join(', ') || '—'}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center print:border-gray-300 print:bg-white">
        <div className="text-[11px] uppercase tracking-wide text-gray-400 print:text-gray-700">
          Throughput
        </div>
        <div className="mt-1 text-3xl font-bold text-white print:text-black">
          {totalWeightTons.toFixed(1)}t
        </div>
        <div className="text-[11px] text-gray-500">total material processed</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 print:border-gray-300 print:bg-white">
        <div className="text-[11px] uppercase tracking-wide text-gray-400 print:text-gray-700">
          This month
        </div>
        <div className="mt-2 space-y-1 text-xs">
          <ReportRow label="Total bags processed" value={bagsProcessed.toLocaleString()} />
          <ReportRow label="Mill shipments sent" value={shipmentsCount.toLocaleString()} />
          <ReportRow
            label="Contamination rate"
            value={`${contaminationRate.toFixed(1)}%`}
            accent={contaminationRate >= 5 ? 'danger' : 'none'}
          />
          <ReportRow
            label="Points awarded"
            value={totalPointsAwarded.toLocaleString()}
          />
          <ReportRow
            label="Est. revenue from mills"
            value={`$${millRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 print:border-gray-300 print:bg-white">
        <div className="text-[11px] uppercase tracking-wide text-gray-400 print:text-gray-700">
          By material
        </div>
        <div className="mt-2 space-y-1 text-xs">
          {MATERIAL_IDS.map((id) => (
            <ReportRow
              key={id}
              label={MATERIAL_DISPLAY_NAMES[id]}
              value={`${aggregateWeights[id].toLocaleString(undefined, { maximumFractionDigits: 1 })} lbs`}
            />
          ))}
        </div>
      </div>

      <div className="print:hidden">
        <PrintButton />
      </div>
    </section>
  );
}

function ReportRow({
  label,
  value,
  accent = 'none',
}: {
  label: string;
  value: string;
  accent?: 'none' | 'danger';
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-300 print:text-gray-700">{label}</span>
      <span
        className={`font-semibold ${
          accent === 'danger' ? 'text-red-300' : 'text-white'
        } print:text-black`}
      >
        {value}
      </span>
    </div>
  );
}
