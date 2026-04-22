'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  COMPLIANCE_NOTICE_LABELS,
} from '@/lib/types/complianceBatch';
import type { ComplianceNoticeType } from '@/lib/types/complianceNotice';

interface ZoneOption {
  id: string;
  name: string;
  residentCount: number;
}

const NOTICE_TYPES: ComplianceNoticeType[] = ['initial_service', 'semi_annual'];

export function NewBatchForm({ zones }: { zones: ZoneOption[] }) {
  const router = useRouter();
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '');
  const [type, setType] = useState<ComplianceNoticeType>('initial_service');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedZone = zones.find((z) => z.id === zoneId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/compliance-batches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ zoneId, type, notes: notes.trim() || null }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'generate_failed');
      setNotes('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'generate_failed');
    } finally {
      setBusy(false);
    }
  }

  if (zones.length === 0) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/5 p-5 text-xs text-gray-400">
        No zones configured yet — create a zone before generating notices.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-sm font-semibold text-white">Generate a new batch</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Creates a batch record for audit. Open the printable view to produce letters for all
        residents in the zone.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="text-gray-400">Zone</span>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="mt-1 block w-full rounded border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} · {z.residentCount} resident{z.residentCount === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-gray-400">Notice type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ComplianceNoticeType)}
            className="mt-1 block w-full rounded border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
          >
            {NOTICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMPLIANCE_NOTICE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="text-gray-400">Notes (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Mailed by Kirk via USPS first class"
            className="mt-1 block w-full rounded border border-white/15 bg-black/40 px-2 py-2 text-sm text-white placeholder:text-gray-600"
          />
        </label>
        {error && (
          <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !zoneId}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? 'Generating…' : `Generate batch${selectedZone ? ` · ${selectedZone.residentCount} letters` : ''}`}
          </button>
        </div>
      </form>
    </section>
  );
}
