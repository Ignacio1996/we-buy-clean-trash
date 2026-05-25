'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ZoneDoc } from '@/lib/types/zone';
import type { DepotDoc } from '@/lib/types/depot';
import { resolveAcceptedMaterials } from '@/lib/types/depot';
import { type MaterialId, type PayoutMode } from '@/lib/types/material';

type ZoneView = Omit<ZoneDoc, 'createdAt'>;
type DepotView = Omit<DepotDoc, 'createdAt'>;

export interface MaterialChip {
  id: MaterialId;
  name: string;
  payoutMode: PayoutMode;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDays(days: number[]): string {
  if (!days || days.length === 0) return '—';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAYS[d])
    .join(', ');
}

export function ZonesClient({
  zones,
  depots,
  materials,
}: {
  zones: ZoneView[];
  depots: DepotView[];
  materials: MaterialChip[];
}) {
  const depotNameById = new Map(depots.map((d) => [d.id, d.name]));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section>
        <h2 className="text-sm font-semibold text-white">Depots</h2>
        <DepotList depots={depots} materials={materials} />
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

function DepotList({ depots, materials }: { depots: DepotView[]; materials: MaterialChip[] }) {
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
          <DepotCard
            key={d.id}
            depot={d}
            materials={materials}
            onDelete={() => handleDelete(d.id)}
            deleting={busyId === d.id}
          />
        ))
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function DepotCard({
  depot,
  materials,
  onDelete,
  deleting,
}: {
  depot: DepotView;
  materials: MaterialChip[];
  onDelete: () => void;
  deleting: boolean;
}) {
  const router = useRouter();
  const allMaterialIds = materials.map((m) => m.id);
  const initial = resolveAcceptedMaterials(depot, allMaterialIds);
  const [accepted, setAccepted] = useState<MaterialId[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    accepted.length !== initial.length ||
    accepted.some((id) => !initial.includes(id)) ||
    initial.some((id) => !accepted.includes(id));

  function toggle(id: MaterialId) {
    setError(null);
    setAccepted((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function save() {
    if (accepted.length === 0) {
      setError('Pick at least one material.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/depots/${depot.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acceptedMaterials: accepted }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === 'string' ? json.error : 'Save failed.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-white">{depot.name}</div>
          <div className="text-xs text-gray-500">
            {depot.street}, {depot.city}, {depot.state} {depot.postalCode}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          Accepted materials ({accepted.length}/{materials.length})
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {materials.map((m) => {
            const on = accepted.includes(m.id);
            const isDiversion = m.payoutMode === 'diversion_only';
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                title={isDiversion ? 'Diversion-only — no points' : 'Cash material'}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  on
                    ? isDiversion
                      ? 'border-blue-400/50 bg-blue-500/15 text-blue-200'
                      : 'border-green-500/40 bg-green-500/15 text-green-200'
                    : 'border-white/10 bg-black/30 text-gray-500 hover:bg-white/10'
                }`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
        {dirty && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded bg-white px-2 py-1 text-[11px] font-semibold text-black disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAccepted(initial);
                setError(null);
              }}
              className="text-[11px] text-gray-400 underline"
            >
              Reset
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
      </div>
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
  const [editingDays, setEditingDays] = useState(false);
  const [zipsInput, setZipsInput] = useState(zone.zipCodes.join(', '));
  const [daysInput, setDaysInput] = useState<number[]>(zone.pickupDaysOfWeek);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm('Delete this zone? Any assigned residents will be unassigned.')) return;
    setBusy(true);
    setError(null);
    setFlash(null);
    const res = await fetch(`/api/admin/zones/${zone.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Delete failed.');
      return;
    }
    router.refresh();
  }

  async function handleSaveZips() {
    setBusy(true);
    setError(null);
    setFlash(null);
    const res = await fetch(`/api/admin/zones/${zone.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ zipCodes: zipsInput }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Save failed.');
      return;
    }
    const assigned = Number(json.residentsAssigned ?? 0);
    const unassigned = Number(json.residentsUnassigned ?? 0);
    if (assigned || unassigned) {
      const parts: string[] = [];
      if (assigned) parts.push(`${assigned} assigned`);
      if (unassigned) parts.push(`${unassigned} unassigned`);
      setFlash(`Saved · ${parts.join(', ')}.`);
    } else {
      setFlash('Saved.');
    }
    setEditing(false);
    router.refresh();
  }

  async function handleSaveDays() {
    if (daysInput.length === 0) {
      setError('Pick at least one pickup day.');
      return;
    }
    setBusy(true);
    setError(null);
    setFlash(null);
    const res = await fetch(`/api/admin/zones/${zone.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pickupDaysOfWeek: daysInput }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Save failed.');
      return;
    }
    setEditingDays(false);
    setFlash('Saved.');
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-sm text-white">{zone.name}</div>
          <div className="text-xs text-gray-500">
            Depot: {depotNameById.get(zone.depotId) ?? zone.depotId} · Pickups:{' '}
            {formatDays(zone.pickupDaysOfWeek)}
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
            Pickup days ({zone.pickupDaysOfWeek.length})
          </div>
          {!editingDays && (
            <button
              type="button"
              onClick={() => setEditingDays(true)}
              className="text-[11px] text-gray-400 underline"
            >
              Edit
            </button>
          )}
        </div>
        {editingDays ? (
          <div className="mt-1">
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((label, i) => {
                const on = daysInput.includes(i);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setDaysInput((prev) =>
                        prev.includes(i)
                          ? prev.filter((x) => x !== i)
                          : [...prev, i].sort((a, b) => a - b),
                      )
                    }
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      on
                        ? 'border-green-500/40 bg-green-500/15 text-green-200'
                        : 'border-white/10 bg-black/30 text-gray-500 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDays}
                disabled={busy}
                className="rounded bg-white px-2 py-1 text-[11px] font-semibold text-black disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDaysInput(zone.pickupDaysOfWeek);
                  setEditingDays(false);
                  setError(null);
                }}
                className="text-[11px] text-gray-400 underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 text-xs text-gray-300">{formatDays(zone.pickupDaysOfWeek)}</div>
        )}
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
        {flash && <p className="mt-1 text-[11px] text-green-400">{flash}</p>}
      </div>
    </div>
  );
}

function ZoneForm({ depots }: { depots: DepotView[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    depotId: '',
    zipCodes: '',
  });
  const [pickupDays, setPickupDays] = useState<number[]>([1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(i: number) {
    setPickupDays((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.depotId) {
      setError('Pick a depot first.');
      return;
    }
    if (pickupDays.length === 0) {
      setError('Pick at least one pickup day.');
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
        pickupDaysOfWeek: pickupDays,
        zipCodes: form.zipCodes,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === 'string' ? json.error : 'Create failed.');
      return;
    }
    setForm({ name: '', depotId: '', zipCodes: '' });
    setPickupDays([1]);
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
        <div className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">
            Pickup days ({pickupDays.length})
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const on = pickupDays.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                    on
                      ? 'border-green-500/40 bg-green-500/15 text-green-200'
                      : 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
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
