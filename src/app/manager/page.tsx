import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadManagerDepots } from '@/lib/auth/managerAccess';
import { MATERIAL_DISPLAY_NAMES, type MaterialId } from '@/lib/types/material';
import type { InventoryDoc } from '@/lib/types/inventory';

export const dynamic = 'force-dynamic';

const DEPOT_CAPACITY_LBS_PER_MATERIAL = 1500;
const CRITICAL_PCT = 95;

export default async function ManagerHome() {
  const session = await requireRole('depot_manager');
  const depots = await loadManagerDepots(session.uid);

  if (depots.length === 0) {
    return (
      <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
        No depots are assigned to your account yet. Ask an admin to link a depot to you.
      </section>
    );
  }

  const invSnaps = await Promise.all(
    depots.map((d) => adminDb.collection('inventory').where('depotId', '==', d.id).get()),
  );

  const rows = depots.map((depot, i) => {
    const invMap = new Map<MaterialId, number>();
    invSnaps[i].docs.forEach((snap) => {
      const doc = snap.data() as InventoryDoc;
      invMap.set(doc.materialId, doc.weight ?? 0);
    });
    const total = Array.from(invMap.values()).reduce((a, b) => a + b, 0);
    const critical: { id: MaterialId; pct: number }[] = [];
    invMap.forEach((w, id) => {
      const pct = Math.round((w / DEPOT_CAPACITY_LBS_PER_MATERIAL) * 100);
      if (pct >= CRITICAL_PCT) critical.push({ id, pct });
    });
    return { depot, total, critical };
  });

  const totalAllDepots = rows.reduce((a, r) => a + r.total, 0);

  return (
    <section className="mt-5 space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
          We Buy Clean Trash · Depot Mgr
        </div>
        <h1 className="mt-0.5 text-lg font-semibold text-white">Your depots</h1>
        <div className="mt-0.5 text-xs text-gray-500">
          {depots.length} location{depots.length === 1 ? '' : 's'} managed
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Depots</div>
          <div className="mt-1 text-2xl font-bold text-white">{depots.length}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">In stock</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {(totalAllDepots / 2000).toFixed(1)}t
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map(({ depot, total, critical }) => (
          <Link
            key={depot.id}
            href={`/manager/depots/${depot.id}`}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg">
              🏭
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{depot.name}</div>
              <div className="truncate text-xs text-gray-400">
                {total.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs in stock
                {critical.length > 0 && (
                  <>
                    {' '}
                    · {MATERIAL_DISPLAY_NAMES[critical[0].id]} at {critical[0].pct}%
                  </>
                )}
              </div>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                critical.length > 0
                  ? 'bg-red-500/15 text-red-300'
                  : 'bg-white/10 text-gray-400'
              }`}
            >
              {critical.length > 0 ? 'Full' : 'OK'}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
