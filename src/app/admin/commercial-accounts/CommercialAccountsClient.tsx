'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';
import { BIN_DISPLAY_NAMES, BIN_SIZES, type BinSize } from '@/lib/logic/binWeightTable';
import type { MaterialId } from '@/lib/types/material';
import type { MeasurementMode } from '@/lib/types/material';
import { AddressAutocompleteField } from '@/components/address/AddressAutocompleteField';

// firstMonthOfData is a server-only Timestamp consumed by the report engine,
// not the client UI — omit it here so it stays serializable.
export type CommercialAccountView = Omit<
  CommercialAccountDoc,
  'createdAt' | 'updatedAt' | 'firstMonthOfData'
> & {
  binCount?: number;
};

interface MaterialOption {
  id: MaterialId;
  name: string;
  measurementMode: MeasurementMode;
}

interface ZoneOption {
  id: string;
  name: string;
}

const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;

export function CommercialAccountsClient({
  accounts,
  zones,
  materials,
}: {
  accounts: CommercialAccountView[];
  zones: ZoneOption[];
  materials: MaterialOption[];
}) {
  const active = accounts.filter((a) => a.active !== false);
  const inactive = accounts.filter((a) => a.active === false);

  return (
    <div className="space-y-6">
      <NewAccountForm zones={zones} materials={materials} />

      <section>
        <h2 className="text-sm font-semibold text-white">
          Active sites · {active.length}
        </h2>
        <div className="mt-3 space-y-3">
          {active.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-gray-500">
              No commercial sites yet. Add your first one above.
            </div>
          ) : (
            active.map((a) => (
              <AccountCard key={a.id} account={a} zones={zones} materials={materials} />
            ))
          )}
        </div>
      </section>

      {inactive.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-gray-500">
            Archived · {inactive.length}
          </h2>
          <div className="mt-2 space-y-2">
            {inactive.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-gray-500"
              >
                {a.businessName} ({a.city}, {a.state})
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AccountCard({
  account,
  zones,
  materials,
}: {
  account: CommercialAccountView;
  zones: ZoneOption[];
  materials: MaterialOption[];
}) {
  const router = useRouter();
  const zoneName = zones.find((z) => z.id === account.zoneId)?.name ?? account.zoneId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = account.status === 'paused';

  async function archive() {
    if (!confirm(`Archive ${account.businessName}? Bins remain attached for reporting.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/commercial-accounts/${account.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      setError('Archive failed.');
      return;
    }
    router.refresh();
  }

  async function togglePause() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/commercial-accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: paused ? 'active' : 'paused' }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(paused ? 'Resume failed.' : 'Pause failed.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{account.businessName}</h3>
            {account.affiliationId && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                {account.affiliationId}
              </span>
            )}
            {paused && (
              <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">
                Paused
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-gray-400">
            {account.contactName}
            {account.contactPhone ? ` · ${account.contactPhone}` : ''}
            {account.contactEmail ? ` · ${account.contactEmail}` : ''}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {account.street}
            {account.unit ? `, ${account.unit}` : ''}, {account.city}, {account.state}{' '}
            {account.postalCode}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={togglePause}
            disabled={busy}
            className={`rounded border px-2 py-1 text-[11px] disabled:opacity-50 ${
              paused
                ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                : 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10'
            }`}
          >
            {busy ? '…' : paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={archive}
            disabled={busy}
            className="rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {busy ? '…' : 'Archive'}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <Stat label="Zone" value={zoneName} />
        <Stat label="Default bin" value={BIN_DISPLAY_NAMES[account.defaultBinSize]} />
        <Stat label="Bins on site" value={String(account.binsOnSite ?? 0)} />
        <Stat label="Pickups / week" value={String(account.pickupsPerWeek)} />
        <Stat
          label="Days"
          value={
            account.collectionDays.length > 0
              ? account.collectionDays
                  .map((n) => COLLECTION_DAY_LABELS[n])
                  .filter(Boolean)
                  .join(', ')
              : '—'
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Materials:</span>
        {account.materialIds.map((id) => {
          const m = materials.find((x) => x.id === id);
          return (
            <span
              key={id}
              className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-200"
            >
              {m?.name ?? id}
            </span>
          );
        })}
      </div>

      {account.driverNotes && (
        <div className="mt-3 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-gray-400">
          <span className="text-[9px] uppercase tracking-wide text-gray-500">Driver notes:</span>{' '}
          {account.driverNotes}
        </div>
      )}

      <BinSection account={account} />

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function BinSection({ account }: { account: CommercialAccountView }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [count, setCount] = useState(1);
  const [size, setSize] = useState<BinSize>(account.defaultBinSize);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/commercial-accounts/${account.id}/bins`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ binSize: size, count }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'add_failed');
      return;
    }
    setAdding(false);
    setCount(1);
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-gray-300">
          <span className="text-white">{account.binCount ?? 0}</span> bin
          {(account.binCount ?? 0) === 1 ? '' : 's'} provisioned
        </div>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[11px] text-blue-300 underline hover:text-blue-200"
          >
            Provision bins
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
            className="text-[11px] text-gray-400 underline"
          >
            Cancel
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wide text-gray-500">Size</span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as BinSize)}
              className="mt-0.5 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
            >
              {BIN_SIZES.map((s) => (
                <option key={s} value={s}>
                  {BIN_DISPLAY_NAMES[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wide text-gray-500">Count</span>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="mt-0.5 w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold text-black disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add bins'}
          </button>
          {error && <span className="text-[11px] text-red-400">{error}</span>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-gray-200">{value}</div>
    </div>
  );
}

function NewAccountForm({
  zones,
  materials,
}: {
  zones: ZoneOption[];
  materials: MaterialOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Default selection: prefer materials with bin_fullness measurement (compost flow).
  const defaultMaterialIds = materials
    .filter((m) => m.measurementMode === 'bin_fullness')
    .map((m) => m.id);
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    street: '',
    unit: '',
    city: '',
    state: '',
    postalCode: '',
    zoneId: zones[0]?.id ?? '',
    defaultBinSize: '32' as BinSize,
    binsOnSite: 1,
    pickupsPerWeek: 1,
    collectionDays: [1] as number[],
    affiliationId: '',
    firstMonthOfData: '',
    materialIds: defaultMaterialIds.length > 0 ? defaultMaterialIds : [],
    driverNotes: '',
  });

  function toggleDay(d: number) {
    setForm((f) => {
      const has = f.collectionDays.includes(d);
      const next = has ? f.collectionDays.filter((x) => x !== d) : [...f.collectionDays, d];
      return { ...f, collectionDays: next.sort((a, b) => a - b) };
    });
  }

  function toggleMaterial(id: string) {
    setForm((f) => ({
      ...f,
      materialIds: f.materialIds.includes(id)
        ? f.materialIds.filter((x) => x !== id)
        : [...f.materialIds, id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.materialIds.length === 0) {
      setError('Pick at least one material.');
      return;
    }
    if (form.collectionDays.length === 0) {
      setError('Pick at least one collection day.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/commercial-accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'create_failed');
      return;
    }
    setOpen(false);
    setForm((f) => ({
      ...f,
      businessName: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      street: '',
      unit: '',
      city: '',
      state: '',
      postalCode: '',
      affiliationId: '',
      firstMonthOfData: '',
      driverNotes: '',
    }));
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={zones.length === 0}
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
      >
        {zones.length === 0 ? 'Create a zone first' : '+ Add commercial site'}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">New commercial site</div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-[11px] text-gray-400 underline"
        >
          Cancel
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field
          label="Business name"
          value={form.businessName}
          onChange={(v) => setForm((f) => ({ ...f, businessName: v }))}
          required
          className="sm:col-span-2"
        />
        <Field
          label="Contact name"
          value={form.contactName}
          onChange={(v) => setForm((f) => ({ ...f, contactName: v }))}
          required
        />
        <Field
          label="Contact phone"
          value={form.contactPhone}
          onChange={(v) => setForm((f) => ({ ...f, contactPhone: v }))}
        />
        <Field
          label="Contact email"
          value={form.contactEmail}
          onChange={(v) => setForm((f) => ({ ...f, contactEmail: v }))}
          className="sm:col-span-2"
        />
        <AddressAutocompleteField
          label="Street"
          value={form.street}
          onChange={(v) => setForm((f) => ({ ...f, street: v }))}
          onSelect={(parsed) =>
            setForm((f) => ({
              ...f,
              street: parsed.street || f.street,
              city: parsed.city || f.city,
              state: parsed.state || f.state,
              postalCode: parsed.postalCode || f.postalCode,
            }))
          }
          required
          className="sm:col-span-2"
        />
        <Field
          label="Unit / suite"
          value={form.unit}
          onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
        />
        <Field
          label="City"
          value={form.city}
          onChange={(v) => setForm((f) => ({ ...f, city: v }))}
          required
        />
        <Field
          label="State"
          value={form.state}
          onChange={(v) => setForm((f) => ({ ...f, state: v }))}
          required
        />
        <Field
          label="ZIP"
          value={form.postalCode}
          onChange={(v) => setForm((f) => ({ ...f, postalCode: v }))}
          required
        />
        <label className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Zone</span>
          <select
            value={form.zoneId}
            onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Default bin</span>
          <select
            value={form.defaultBinSize}
            onChange={(e) =>
              setForm((f) => ({ ...f, defaultBinSize: e.target.value as BinSize }))
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {BIN_SIZES.map((s) => (
              <option key={s} value={s}>
                {BIN_DISPLAY_NAMES[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Bins on site</span>
          <input
            type="number"
            min={0}
            max={99}
            value={form.binsOnSite}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                binsOnSite: Math.max(0, Math.min(99, Number(e.target.value) || 0)),
              }))
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Pickups / week</span>
          <input
            type="number"
            min={1}
            max={7}
            value={form.pickupsPerWeek}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                pickupsPerWeek: Math.max(1, Math.min(7, Number(e.target.value) || 1)),
              }))
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <Field
          label="Affiliation tag (optional)"
          value={form.affiliationId}
          onChange={(v) => setForm((f) => ({ ...f, affiliationId: v }))}
          placeholder="compost_clubhouse · city_of_columbus"
        />
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">
            First month of data
          </span>
          <input
            type="month"
            value={form.firstMonthOfData}
            onChange={(e) => setForm((f) => ({ ...f, firstMonthOfData: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">
            Collection days
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAY_NUMBERS.map((d) => {
              const on = form.collectionDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                    on
                      ? 'border-blue-400/50 bg-blue-500/15 text-blue-200'
                      : 'border-white/10 bg-black/30 text-gray-500 hover:bg-white/10'
                  }`}
                >
                  {COLLECTION_DAY_LABELS[d]}
                </button>
              );
            })}
          </div>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Materials</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {materials.map((m) => {
              const on = form.materialIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMaterial(m.id)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    on
                      ? 'border-blue-400/50 bg-blue-500/15 text-blue-200'
                      : 'border-white/10 bg-black/30 text-gray-500 hover:bg-white/10'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">
            Driver notes (optional)
          </span>
          <textarea
            value={form.driverNotes}
            onChange={(e) => setForm((f) => ({ ...f, driverNotes: e.target.value }))}
            rows={2}
            placeholder="Gate code, bin location on-site, who to ask for…"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Create site'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] uppercase tracking-wide text-gray-500">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}
