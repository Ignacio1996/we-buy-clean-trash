'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ZoneDoc } from '@/lib/types/zone';
import type { DepotDoc } from '@/lib/types/depot';

type ZoneView = Omit<ZoneDoc, 'createdAt'>;
type DepotView = Omit<DepotDoc, 'createdAt'>;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ZonesClient({ zones, depots }: { zones: ZoneView[]; depots: DepotView[] }) {
  const depotNameById = new Map(depots.map((d) => [d.id, d.name]));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section>
        <h2 className="text-sm font-semibold text-white">Depots</h2>
        <DepotList depots={depots} />
        <DepotForm />
      </section>
      <section>
        <h2 className="text-sm font-semibold text-white">Zones</h2>
        <ZoneList zones={zones} depotNameById={depotNameById} />
        <ZoneForm depots={depots} />
      </section>
    </div>
  );
}

function DepotList({ depots }: { depots: DepotView[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm('Delete this depot?')) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/depots/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(
        json.error === 'depot_has_zones'
          ? 'Cannot delete: zones still reference this depot.'
          : 'Delete failed.',
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2">
      {depots.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-gray-500">
          No depots yet.
        </div>
      ) : (
        depots.map((d) => (
          <div
            key={d.id}
            className="flex items-start justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <div>
              <div className="text-sm text-white">{d.name}</div>
              <div className="text-xs text-gray-500">
                {d.street}, {d.city}, {d.state} {d.postalCode}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(d.id)}
              disabled={busyId === d.id}
              className="rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              {busyId === d.id ? '…' : 'Delete'}
            </button>
          </div>
        ))
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function DepotForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', street: '', city: '', state: '', postalCode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/depots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === 'string' ? json.error : 'Create failed.');
      return;
    }
    setForm({ name: '', street: '', city: '', state: '', postalCode: '' });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">New depot</div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          label="Name"
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          className="sm:col-span-2"
        />
        <Input
          label="Street"
          value={form.street}
          onChange={(v) => setForm((f) => ({ ...f, street: v }))}
          className="sm:col-span-2"
        />
        <Input label="City" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="State"
            value={form.state}
            onChange={(v) => setForm((f) => ({ ...f, state: v }))}
          />
          <Input
            label="ZIP"
            value={form.postalCode}
            onChange={(v) => setForm((f) => ({ ...f, postalCode: v }))}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Add depot'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </form>
  );
}

function ZoneList({
  zones,
  depotNameById,
}: {
  zones: ZoneView[];
  depotNameById: Map<string, string>;
}) {
  return (
    <div className="mt-3 space-y-2">
      {zones.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-gray-500">
          No zones yet.
        </div>
      ) : (
        zones.map((z) => <ZoneCard key={z.id} zone={z} depotNameById={depotNameById} />)
      )}
    </div>
  );
}

function ZoneCard({
  zone,
  depotNameById,
}: {
  zone: ZoneView;
  depotNameById: Map<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [zipsInput, setZipsInput] = useState(zone.zipCodes.join(', '));
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm('Delete this zone?')) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/zones/${zone.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(
        json.error === 'zone_has_residents'
          ? 'Cannot delete: residents are still assigned to this zone.'
          : 'Delete failed.',
      );
      return;
    }
    router.refresh();
  }

  async function handleSaveZips() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/zones/${zone.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ zipCodes: zipsInput }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === 'string' ? json.error : 'Save failed.');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-sm text-white">{zone.name}</div>
          <div className="text-xs text-gray-500">
            Depot: {depotNameById.get(zone.depotId) ?? zone.depotId} · Pickup:{' '}
            {DAYS[zone.pickupDayOfWeek] ?? '—'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="shrink-0 rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {busy ? '…' : 'Delete'}
        </button>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            ZIP codes ({zone.zipCodes.length})
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] text-gray-400 underline"
            >
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <div className="mt-1">
            <textarea
              value={zipsInput}
              onChange={(e) => setZipsInput(e.target.value)}
              rows={3}
              placeholder="10001, 10002, 10003…"
              className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveZips}
                disabled={busy}
                className="rounded bg-white px-2 py-1 text-[11px] font-semibold text-black disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setZipsInput(zone.zipCodes.join(', '));
                  setEditing(false);
                  setError(null);
                }}
                className="text-[11px] text-gray-400 underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 text-xs text-gray-300">
            {zone.zipCodes.length === 0 ? (
              <span className="text-gray-500">None — add some to auto-assign residents.</span>
            ) : (
              zone.zipCodes.join(', ')
            )}
          </div>
        )}
        {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function ZoneForm({ depots }: { depots: DepotView[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    depotId: '',
    pickupDayOfWeek: '1',
    zipCodes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.depotId) {
      setError('Pick a depot first.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/zones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        depotId: form.depotId,
        pickupDayOfWeek: Number(form.pickupDayOfWeek),
        zipCodes: form.zipCodes,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === 'string' ? json.error : 'Create failed.');
      return;
    }
    setForm({ name: '', depotId: '', pickupDayOfWeek: '1', zipCodes: '' });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">New zone</div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          label="Name"
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          className="sm:col-span-2"
        />
        <label className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Depot</span>
          <select
            value={form.depotId}
            onChange={(e) => setForm((f) => ({ ...f, depotId: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          >
            <option value="">Select a depot…</option>
            {depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Pickup day</span>
          <select
            value={form.pickupDayOfWeek}
            onChange={(e) => setForm((f) => ({ ...f, pickupDayOfWeek: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">
            ZIP codes (comma or newline separated)
          </span>
          <textarea
            value={form.zipCodes}
            onChange={(e) => setForm((f) => ({ ...f, zipCodes: e.target.value }))}
            rows={2}
            placeholder="10001, 10002, 10003"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || depots.length === 0}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Add zone'}
        </button>
        {depots.length === 0 && (
          <span className="text-xs text-gray-500">Create a depot first.</span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] uppercase tracking-wide text-gray-500">{label}</span>
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}
