'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Option {
  id: string;
  name: string;
}

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function RouteBuilderClient({
  zones,
  operators,
}: {
  zones: Option[];
  operators: Option[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    date: todayIsoDate(),
    zoneId: zones[0]?.id ?? '',
    operatorId: operators[0]?.id ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { ok: true; stops: number; bagOrders: number; mocked: boolean } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.zoneId || !form.operatorId || !form.date) {
      setError('Pick a date, zone, and operator.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch('/api/route-optimize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = typeof json.error === 'string' ? json.error : 'build_failed';
      setError(friendlyBuildError(code));
      return;
    }
    setResult({
      ok: true,
      stops: json.stops ?? 0,
      bagOrders: json.bagOrders ?? 0,
      mocked: Boolean(json.mocked),
    });
    router.refresh();
  }

  const disabled = zones.length === 0 || operators.length === 0;

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">Build a route</div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Date</span>
          <input
            type="date"
            value={form.date}
            min={todayIsoDate()}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Zone</span>
          <select
            value={form.zoneId}
            onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          >
            {zones.length === 0 ? (
              <option value="">— no zones —</option>
            ) : (
              zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Operator</span>
          <select
            value={form.operatorId}
            onChange={(e) => setForm((f) => ({ ...f, operatorId: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          >
            {operators.length === 0 ? (
              <option value="">— no operators —</option>
            ) : (
              operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || disabled}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Optimizing…' : 'Build route'}
        </button>
        {disabled && (
          <span className="text-xs text-gray-500">
            {zones.length === 0
              ? 'Create a zone first.'
              : 'Invite an operator first (Admin → Invites).'}
          </span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
        {result && (
          <span className="text-xs text-green-400">
            Built: {result.stops} stop{result.stops === 1 ? '' : 's'}, {result.bagOrders} bag order
            {result.bagOrders === 1 ? '' : 's'}
            {result.mocked ? ' (mock ordering)' : ''}
          </span>
        )}
      </div>
    </form>
  );
}

function friendlyBuildError(code: string): string {
  switch (code) {
    case 'route_already_exists':
      return 'A route already exists for this operator/zone/day. Delete it from the table below to rebuild.';
    case 'invalid_payload':
      return 'Pick a date, zone, and operator.';
    case 'invalid_operator':
      return 'That user isn’t an operator.';
    case 'depot_geocode_failed':
      return 'Couldn’t geocode the depot address.';
    default:
      return code;
  }
}
