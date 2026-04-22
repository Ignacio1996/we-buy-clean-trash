'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MATERIAL_DISPLAY_NAMES, MATERIAL_IDS, type MaterialId } from '@/lib/types/material';
import type { MillShipmentStatus } from '@/lib/types/millShipment';

interface Shipment {
  id: string;
  mill: string;
  scheduledFor: string | null;
  status: MillShipmentStatus;
  weights: Record<MaterialId, number>;
}

const STATUS_STYLE: Record<MillShipmentStatus, string> = {
  scheduled: 'bg-amber-500/15 text-amber-300',
  picked_up: 'bg-green-500/15 text-green-300',
  cancelled: 'bg-white/10 text-gray-400',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ShipmentsList({ shipments }: { shipments: Shipment[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (shipments.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-gray-500">
        No mill shipments yet.
      </div>
    );
  }

  async function patch(shipmentId: string, action: 'mark_picked_up' | 'cancel') {
    setBusyId(shipmentId);
    setError(null);
    try {
      const res = await fetch('/api/mill-shipments', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shipmentId, action }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'update_failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'update_failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">Mill shipments</div>
      {error && (
        <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
      <div className="mt-2 divide-y divide-white/5">
        {shipments.map((s) => {
          const total = MATERIAL_IDS.reduce((a, id) => a + (s.weights?.[id] ?? 0), 0);
          return (
            <div key={s.id} className="py-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{s.mill}</div>
                  <div className="text-[11px] text-gray-500">
                    {formatDate(s.scheduledFor)} · {total.toFixed(0)} lbs
                  </div>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[s.status]}`}
                >
                  {s.status.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                {MATERIAL_IDS.filter((id) => (s.weights?.[id] ?? 0) > 0)
                  .map((id) => `${MATERIAL_DISPLAY_NAMES[id]} ${s.weights[id].toFixed(0)}`)
                  .join(' · ') || 'No materials'}
              </div>
              {s.status === 'scheduled' && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => patch(s.id, 'mark_picked_up')}
                    disabled={busyId === s.id}
                    className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                  >
                    Mark picked up
                  </button>
                  <button
                    type="button"
                    onClick={() => patch(s.id, 'cancel')}
                    disabled={busyId === s.id}
                    className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
