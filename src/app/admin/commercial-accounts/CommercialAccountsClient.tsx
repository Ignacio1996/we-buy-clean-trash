'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Boxes,
  CalendarDays,
  Pause,
  Search,
  Archive,
  MapPin,
  Phone,
  Mail,
  Pencil,
  Printer,
  Plus,
  Check,
  X,
} from 'lucide-react';
import type { CommercialAccountDoc, SiteType } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS, SITE_TYPE_LABELS } from '@/lib/types/commercialAccount';
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

  // Day-of-week filter — "which sites run on Monday?" Tia asked for this so she
  // can sanity-check the day's route against the schedule. `null` = all days.
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const dayCounts = new Map<number, number>();
  for (const a of active) {
    for (const d of Array.isArray(a.collectionDays) ? a.collectionDays : []) {
      dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
    }
  }

  const q = query.trim().toLowerCase();
  const shownActive = active.filter((a) => {
    if (
      dayFilter != null &&
      !(Array.isArray(a.collectionDays) && a.collectionDays.includes(dayFilter))
    ) {
      return false;
    }
    if (q) {
      const hay = [
        a.businessName,
        a.contactName,
        a.contactEmail,
        a.contactPhone,
        a.street,
        a.city,
        a.affiliationId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const filtering = dayFilter != null || query.trim() !== '';
  const totalBins = active.reduce((sum, a) => sum + (a.binCount ?? 0), 0);
  const pausedCount = active.filter((a) => a.status === 'paused').length;

  return (
    <div className="space-y-6">
      <NewAccountForm zones={zones} materials={materials} />

      {/* KPI overview — quick read on the program before drilling into a site. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Building2} label="Active sites" value={active.length} tint="blue" />
        <StatCard icon={Boxes} label="Bins provisioned" value={totalBins} tint="emerald" />
        <StatCard icon={Pause} label="Paused" value={pausedCount} tint="orange" />
        <StatCard icon={Archive} label="Archived" value={inactive.length} tint="gray" />
      </div>

      <section>
        {/* Toolbar — search + day filter. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sites, contacts, addresses…"
              className="w-full rounded-lg border border-white/10 bg-black/40 py-1.5 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:border-white/30 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <FilterChip active={dayFilter == null} onClick={() => setDayFilter(null)}>
              All days
            </FilterChip>
            {DAY_NUMBERS.map((d) => {
              const count = dayCounts.get(d) ?? 0;
              const on = dayFilter === d;
              return (
                <FilterChip
                  key={d}
                  active={on}
                  muted={count === 0}
                  onClick={() => setDayFilter(on ? null : d)}
                >
                  {COLLECTION_DAY_LABELS[d]}
                  <span className="ml-1 text-[10px] opacity-70">{count}</span>
                </FilterChip>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Active sites
            <span className="ml-1.5 text-gray-500">
              {shownActive.length}
              {filtering && active.length !== shownActive.length ? ` of ${active.length}` : ''}
            </span>
          </h2>
        </div>

        <div className="mt-3 space-y-3">
          {active.length === 0 ? (
            <EmptyState>No commercial sites yet. Add your first one above.</EmptyState>
          ) : shownActive.length === 0 ? (
            <EmptyState>
              No sites match{' '}
              {dayFilter != null ? `“${COLLECTION_DAY_LABELS[dayFilter]}”` : 'your search'}.
            </EmptyState>
          ) : (
            shownActive.map((a) => (
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
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-gray-500"
              >
                <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-gray-400">{a.businessName}</span>
                <span className="text-gray-600">
                  · {a.city}, {a.state}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const TINTS = {
  blue: 'text-blue-300',
  emerald: 'text-emerald-300',
  orange: 'text-orange-300',
  gray: 'text-gray-400',
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  tint: keyof typeof TINTS;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500">
        <Icon className={`h-3.5 w-3.5 ${TINTS[tint]}`} strokeWidth={1.75} aria-hidden />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function FilterChip({
  active,
  muted,
  onClick,
  children,
}: {
  active: boolean;
  muted?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
        active
          ? 'border-blue-400/50 bg-blue-500/15 text-blue-200'
          : 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
      } ${muted ? 'opacity-40' : ''}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-gray-500">
      {children}
    </div>
  );
}

function SiteTypeBadge({ siteType }: { siteType: SiteType }) {
  if (siteType === 'recycling_check') {
    return <Badge tone="blue">Recycling check</Badge>;
  }
  if (siteType === 'recycling_weighed') {
    return <Badge tone="blue">Recycling · weighed</Badge>;
  }
  return <Badge tone="emerald">Compost</Badge>;
}

function Badge({
  tone,
  children,
}: {
  tone: 'blue' | 'emerald' | 'amber' | 'orange';
  children: React.ReactNode;
}) {
  const tones = {
    blue: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
    emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    orange: 'border-orange-500/40 bg-orange-500/15 text-orange-300 font-semibold',
  } as const;
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${tones[tone]}`}>
      {children}
    </span>
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
  const [editing, setEditing] = useState(false);
  const paused = account.status === 'paused';

  const materialNames = account.materialIds
    .map((id) => materials.find((m) => m.id === id)?.name ?? id)
    .filter(Boolean);
  const sortedDays = [...(account.collectionDays ?? [])].sort((a, b) => a - b);

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
    <div
      className={`rounded-xl border bg-white/5 p-4 transition-colors ${
        paused ? 'border-orange-500/20' : 'border-white/10'
      }`}
    >
      {/* Header: identity + primary actions. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{account.businessName}</h3>
            <SiteTypeBadge siteType={account.siteType ?? 'compost'} />
            {account.affiliationId && <Badge tone="amber">{account.affiliationId}</Badge>}
            {paused && <Badge tone="orange">Paused</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
            <span>{account.contactName}</span>
            {account.contactPhone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-gray-500" aria-hidden />
                {account.contactPhone}
              </span>
            )}
            {account.contactEmail && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3 text-gray-500" aria-hidden />
                {account.contactEmail}
              </span>
            )}
          </div>
          <div className="mt-1 inline-flex items-start gap-1 text-xs text-gray-500">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-gray-600" aria-hidden />
            <span>
              {account.street}
              {account.unit ? `, ${account.unit}` : ''}, {account.city}, {account.state}{' '}
              {account.postalCode}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors ${
              editing
                ? 'border-blue-400/40 bg-blue-500/10 text-blue-200'
                : 'border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            <Pencil className="h-3 w-3" aria-hidden />
            {editing ? 'Done' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={togglePause}
            disabled={busy}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] disabled:opacity-50 ${
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
            className="inline-flex items-center gap-1 rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Archive className="h-3 w-3" aria-hidden />
            {busy ? '…' : 'Archive'}
          </button>
        </div>
      </div>

      {/* Read-only summary — always visible, scannable. */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
        <Stat label="Zone" value={zoneName} />
        <Stat label="Default bin" value={BIN_DISPLAY_NAMES[account.defaultBinSize]} />
        <Stat
          label="Pickups / week"
          value={String(account.pickupsPerWeek ?? '—')}
        />
        <Stat
          label="Route order"
          value={typeof account.routeOrder === 'number' ? `#${account.routeOrder}` : '—'}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-gray-500" aria-hidden />
          <div className="flex flex-wrap gap-1">
            {sortedDays.length === 0 ? (
              <span className="text-gray-500">No days set</span>
            ) : (
              sortedDays.map((d) => (
                <span
                  key={d}
                  className="rounded border border-blue-400/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-200"
                >
                  {COLLECTION_DAY_LABELS[d]}
                </span>
              ))
            )}
          </div>
        </div>
        {materialNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {materialNames.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-300"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {account.driverNotes && (
        <div className="mt-3 rounded border border-white/10 bg-black/20 px-2.5 py-1.5 text-[11px] text-gray-400">
          <span className="text-[9px] uppercase tracking-wide text-gray-500">Driver notes:</span>{' '}
          {account.driverNotes}
        </div>
      )}

      {/* Bins: provisioning + QR printing is an ongoing action, kept always visible. */}
      <BinSection account={account} />

      {/* Editing controls behind progressive disclosure. */}
      {editing && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Edit site details
          </div>
          <SiteTypeField account={account} />
          <ScheduleField account={account} />
          <MaterialsField account={account} materials={materials} />
          <RouteOrderField account={account} />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

/**
 * Inline stop-type editor — lets the admin convert an existing site between
 * compost, recycling check, and weighed recycling (e.g. flip Dora's Loft to the
 * reusable-tote flow) without recreating it and losing its history.
 */
function SiteTypeField({ account }: { account: CommercialAccountView }) {
  const router = useRouter();
  const initial: SiteType = account.siteType ?? 'compost';
  const [value, setValue] = useState<SiteType>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: SiteType) {
    setValue(next);
    setSaved(false);
    if (next === initial) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/commercial-accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ siteType: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Save failed');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
        Stop type
      </span>
      <select
        value={value}
        onChange={(e) => save(e.target.value as SiteType)}
        disabled={busy}
        className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        {(Object.keys(SITE_TYPE_LABELS) as SiteType[]).map((t) => (
          <option key={t} value={t}>
            {SITE_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <SaveState busy={busy} saved={saved} error={error} />
    </div>
  );
}

/**
 * Inline materials editor — toggle which materials a site collects. Needed to
 * assign the recycling material when converting a site to the weighed flow.
 * Keeps at least one material (the PATCH API rejects an empty list).
 */
function MaterialsField({
  account,
  materials,
}: {
  account: CommercialAccountView;
  materials: MaterialOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(account.materialIds);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    selected.length !== account.materialIds.length ||
    selected.some((id) => !account.materialIds.includes(id));

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!dirty) return;
    if (selected.length === 0) {
      setError('Pick at least one material.');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/commercial-accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ materialIds: selected }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Save failed');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Materials</span>
        <div className="flex items-center gap-2">
          <SaveState busy={busy} saved={saved} error={error} />
          <SaveButton onClick={save} disabled={busy || !dirty} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {materials.map((m) => {
          const on = selected.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
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
    </div>
  );
}

/**
 * Inline schedule editor — collection days, declared bins on site, and pickups
 * per week. Lets the admin fix a site's delivery days (e.g. Sun → Mon) without
 * re-running a seed script. Saves all three fields in one PATCH.
 */
function ScheduleField({ account }: { account: CommercialAccountView }) {
  const router = useRouter();
  const initialDays = account.collectionDays;
  const [days, setDays] = useState<number[]>(initialDays);
  const [bins, setBins] = useState<number>(account.binsOnSite ?? 0);
  const [perWeek, setPerWeek] = useState<number>(account.pickupsPerWeek);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    bins !== (account.binsOnSite ?? 0) ||
    perWeek !== account.pickupsPerWeek ||
    days.length !== initialDays.length ||
    days.some((d, i) => d !== initialDays[i]);

  function toggle(d: number) {
    setSaved(false);
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  }

  async function save() {
    if (!dirty) return;
    if (days.length === 0) {
      setError('Pick at least one collection day.');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/commercial-accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collectionDays: days, binsOnSite: bins, pickupsPerWeek: perWeek }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'Save failed');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Schedule</span>
        <div className="flex items-center gap-2">
          <SaveState busy={busy} saved={saved} error={error} />
          <SaveButton onClick={save} disabled={busy || !dirty} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {DAY_NUMBERS.map((d) => {
          const on = days.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
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

      <div className="mt-2 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-[9px] uppercase tracking-wide text-gray-500">
            Bins on site
          </span>
          <input
            type="number"
            min={0}
            max={99}
            value={bins}
            onChange={(e) => {
              setSaved(false);
              setBins(Math.max(0, Math.min(99, Number(e.target.value) || 0)));
            }}
            className="mt-0.5 w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="block">
          <span className="block text-[9px] uppercase tracking-wide text-gray-500">
            Pickups / week
          </span>
          <input
            type="number"
            min={1}
            max={7}
            value={perWeek}
            onChange={(e) => {
              setSaved(false);
              setPerWeek(Math.max(1, Math.min(7, Number(e.target.value) || 1)));
            }}
            className="mt-0.5 w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
          />
        </label>
      </div>
    </div>
  );
}

/** Inline route-order editor — saves on blur / Enter so Tia can sequence the route fast. */
function RouteOrderField({ account }: { account: CommercialAccountView }) {
  const router = useRouter();
  const initial = typeof account.routeOrder === 'number' ? String(account.routeOrder) : '';
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (value === initial) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/commercial-accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ routeOrder: value.trim() === '' ? null : Number(value) }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Save failed');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
        Route order
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        placeholder="—"
        className="w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white placeholder-gray-600"
      />
      <SaveState busy={busy} saved={saved} error={error} />
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
  const binCount = account.binCount ?? 0;

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
        <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-300">
          <Boxes className="h-3.5 w-3.5 text-gray-500" aria-hidden />
          <span className="font-semibold text-white">{binCount}</span> bin
          {binCount === 1 ? '' : 's'} provisioned
        </div>
        {!adding ? (
          <div className="flex items-center gap-3">
            {binCount > 0 && (
              <a
                href={`/admin/commercial-accounts/${account.id}/bins/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-300 hover:text-blue-200"
              >
                <Printer className="h-3 w-3" aria-hidden />
                Print QR labels
              </a>
            )}
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 text-[11px] text-blue-300 hover:text-blue-200"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Provision bins
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200"
          >
            <X className="h-3 w-3" aria-hidden />
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

function SaveState({
  busy,
  saved,
  error,
}: {
  busy: boolean;
  saved: boolean;
  error: string | null;
}) {
  if (busy) return <span className="text-[10px] text-gray-500">Saving…</span>;
  if (error) return <span className="text-[10px] text-red-400">{error}</span>;
  if (saved)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-green-400">
        <Check className="h-3 w-3" aria-hidden />
        Saved
      </span>
    );
  return null;
}

function SaveButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold text-black transition-opacity disabled:opacity-40"
    >
      Save
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-gray-200">{value}</div>
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
    siteType: 'compost' as SiteType,
    defaultBinSize: '32' as BinSize,
    binsOnSite: 1,
    pickupsPerWeek: 1,
    collectionDays: [1] as number[],
    routeOrder: '' as string,
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
      routeOrder: '',
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
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {zones.length === 0 ? (
          'Create a zone first'
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add commercial site
          </>
        )}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400">
          <Building2 className="h-3.5 w-3.5 text-blue-300" aria-hidden />
          New commercial site
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200"
        >
          <X className="h-3 w-3" aria-hidden />
          Cancel
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <FormSection title="Business">
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
        </FormSection>

        <FormSection title="Location">
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
          <label className="block">
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
        </FormSection>

        <FormSection title="Service">
          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Stop type</span>
            <select
              value={form.siteType}
              onChange={(e) => setForm((f) => ({ ...f, siteType: e.target.value as SiteType }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              {(Object.keys(SITE_TYPE_LABELS) as SiteType[]).map((t) => (
                <option key={t} value={t}>
                  {SITE_TYPE_LABELS[t]}
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
            <span className="text-[11px] uppercase tracking-wide text-gray-500">
              Pickups / week
            </span>
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
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">
              Route order (optional)
            </span>
            <input
              type="number"
              min={0}
              value={form.routeOrder}
              onChange={(e) => setForm((f) => ({ ...f, routeOrder: e.target.value }))}
              placeholder="Stop # on the route"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600"
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
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
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
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
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
        </FormSection>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Create site'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
    </div>
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
