'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  COMPLIANCE_NOTICE_LABELS,
  type ComplianceBatchStatus,
} from '@/lib/types/complianceBatch';
import type { ComplianceNoticeType } from '@/lib/types/complianceNotice';

interface Batch {
  id: string;
  zoneId: string;
  zoneName: string;
  type: ComplianceNoticeType;
  residentCount: number;
  excludedActiveResidents: number;
  status: ComplianceBatchStatus;
  generatedAt: string | null;
  mailedAt: string | null;
  notes: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLE: Record<ComplianceBatchStatus, string> = {
  generated: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  mailed: 'bg-green-500/15 text-green-300 border-green-500/30',
};

export function BatchList({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markMailed(batchId: string) {
    setBusyId(batchId);
    setError(null);
    try {
      const res = await fetch('/api/compliance-batches', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ batchId, action: 'mark_mailed' }),
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
    <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-sm font-semibold text-white">Recent batches</h2>
      {error && (
        <p className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
      {batches.length === 0 ? (
        <p className="mt-4 text-xs text-gray-500">No compliance notices generated yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/5">
          {batches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-white">
                  {COMPLIANCE_NOTICE_LABELS[b.type]} — {b.zoneName}
                </div>
                <div className="truncate text-[11px] text-gray-500">
                  {b.residentCount} unit{b.residentCount === 1 ? '' : 's'}
                  {b.type === 'initial_service' && b.excludedActiveResidents > 0 && (
                    <> · {b.excludedActiveResidents} active resident
                      {b.excludedActiveResidents === 1 ? '' : 's'} skipped</>
                  )}
                  {' · Generated '}
                  {formatDate(b.generatedAt)}
                  {b.status === 'mailed' && b.mailedAt && (
                    <> · Mailed {formatDate(b.mailedAt)}</>
                  )}
                  {b.notes && <> · {b.notes}</>}
                </div>
              </div>
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[b.status]}`}
              >
                {b.status}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/compliance/${b.id}/print`}
                  target="_blank"
                  className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
                >
                  Print letters
                </Link>
                {b.status === 'generated' && (
                  <button
                    type="button"
                    onClick={() => markMailed(b.id)}
                    disabled={busyId === b.id}
                    className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    Mark as mailed
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
