'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@/lib/types/role';

export interface UserRow {
  uid: string;
  name: string;
  email: string | null;
  role: Role;
  zoneName: string;
  pointsBalance: number;
  pointsValue: string;
  phone: string | null;
  address: string | null;
  zip: string | null;
  isTest: boolean;
}

/** Escape a single CSV field per RFC 4180 (quote if it contains , " or newline). */
function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EXPORT_COLUMNS: Array<{ header: string; get: (r: UserRow) => string }> = [
  { header: 'Name', get: (r) => r.name },
  { header: 'Email', get: (r) => r.email ?? '' },
  { header: 'Phone', get: (r) => r.phone ?? '' },
  { header: 'Address', get: (r) => r.address ?? '' },
  { header: 'Zone', get: (r) => r.zoneName },
  { header: 'Zip code', get: (r) => r.zip ?? '' },
];

function exportRowsToCsv(rows: UserRow[]) {
  const lines = [
    EXPORT_COLUMNS.map((c) => csvCell(c.header)).join(','),
    ...rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(c.get(r))).join(',')),
  ];
  // Prepend a UTF-8 BOM so Excel opens accented characters correctly.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wbct-users-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ROLE_LABELS: Record<Role, string> = {
  resident: 'Resident',
  operator: 'Operator',
  depot_worker: 'Depot worker',
  depot_manager: 'Depot manager',
  admin: 'Admin',
};

const ROLE_BADGE: Record<Role, string> = {
  resident: 'bg-emerald-500/10 text-emerald-300',
  operator: 'bg-sky-500/10 text-sky-300',
  depot_worker: 'bg-amber-500/10 text-amber-300',
  depot_manager: 'bg-violet-500/10 text-violet-300',
  admin: 'bg-rose-500/10 text-rose-300',
};

type Filter = 'all' | Role;

const FILTER_ORDER: Role[] = ['resident', 'operator', 'depot_worker', 'depot_manager', 'admin'];

export function AdminUsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [hideTest, setHideTest] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Holds the uids queued for deletion while the confirm dialog is open.
  const [pending, setPending] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  // uid currently mid-flight on a test-flag toggle (disables its control).
  const [togglingTest, setTogglingTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of users) c[u.role] = (c[u.role] ?? 0) + 1;
    return c;
  }, [users]);

  const testCount = useMemo(() => users.filter((u) => u.isTest).length, [users]);

  const visible = useMemo(() => {
    let rows = filter === 'all' ? users : users.filter((u) => u.role === filter);
    if (hideTest) rows = rows.filter((u) => !u.isTest);
    return rows;
  }, [users, filter, hideTest]);

  async function setTestFlag(uid: string, isTest: boolean) {
    setTogglingTest(uid);
    setError(null);
    try {
      const res = await fetch('/api/admin/users/test-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, isTest }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setTogglingTest(null);
    }
  }

  const byUid = new Map(users.map((r) => [r.uid, r]));
  // Anyone except admins can be deleted. Residents cascade-delete all their data;
  // staff (operator/depot_worker/depot_manager) are removed and detached from
  // active assignments, with their history preserved. The delete endpoint refuses
  // admins regardless, so the UI just hides the control for them.
  const deletableVisible = visible.filter((u) => u.role !== 'admin');
  const allSelected =
    deletableVisible.length > 0 && deletableVisible.every((u) => selected.has(u.uid));

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) deletableVisible.forEach((u) => next.delete(u.uid));
      else deletableVisible.forEach((u) => next.add(u.uid));
      return next;
    });
  }

  async function runDelete(uids: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
        failed?: number;
      };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setBusy(false);
        return;
      }
      if (data.failed && data.failed > 0) {
        setError(`Deleted ${data.deleted ?? 0}, but ${data.failed} could not be deleted.`);
      }
      setSelected(new Set());
      setPending(null);
      router.refresh();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const pendingRows = pending?.map((uid) => byUid.get(uid)).filter((r): r is UserRow => !!r) ?? [];
  const pendingNames = pendingRows.map((r) => r.name || r.email || r.uid);
  const hasResident = pendingRows.some((r) => r.role === 'resident');
  const hasStaff = pendingRows.some((r) => r.role !== 'resident');

  return (
    <div>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip
          label="All"
          count={users.length}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        {FILTER_ORDER.map((role) => (
          <FilterChip
            key={role}
            label={ROLE_LABELS[role]}
            count={counts[role] ?? 0}
            active={filter === role}
            onClick={() => setFilter(role)}
          />
        ))}
        <div className="ml-auto flex items-center gap-2">
          {testCount > 0 ? (
            <button
              type="button"
              onClick={() => setHideTest((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                hideTest
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                  : 'border-white/10 bg-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              {hideTest ? 'Test accounts hidden' : `Hide test (${testCount})`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => exportRowsToCsv(visible)}
            disabled={visible.length === 0}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            Export CSV ({visible.length})
          </button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm">
          <span className="text-gray-300">
            {selected.size} selected
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-3 text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          </span>
          <button
            type="button"
            onClick={() => setPending(Array.from(selected))}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
          >
            Delete {selected.size} account{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all deletable users"
                  checked={allSelected}
                  disabled={deletableVisible.length === 0}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer accent-red-500 disabled:opacity-30"
                />
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 font-medium">Zip</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 text-right font-medium">Points</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-xs text-gray-500">
                  No users to show.
                </td>
              </tr>
            ) : (
              visible.map((u) => {
                const deletable = u.role !== 'admin';
                return (
                  <tr
                    key={u.uid}
                    className={selected.has(u.uid) ? 'bg-white/5 text-gray-300' : 'text-gray-300'}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.name}`}
                        checked={selected.has(u.uid)}
                        disabled={!deletable}
                        onChange={() => toggle(u.uid)}
                        className="h-4 w-4 cursor-pointer accent-red-500 disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3 text-white">
                      <span className="inline-flex items-center gap-1.5">
                        {u.name}
                        {u.isTest ? (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                            Test
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE[u.role]}`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{u.zoneName}</td>
                    <td className="px-4 py-3 text-gray-400">{u.zip ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{u.address ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-white">
                      {u.pointsBalance.toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">${u.pointsValue}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          disabled={togglingTest === u.uid}
                          onClick={() => setTestFlag(u.uid, !u.isTest)}
                          className="text-xs text-gray-500 hover:text-amber-300 disabled:opacity-40"
                          title={
                            u.isTest
                              ? 'Remove the test flag — this account will use live Stripe again'
                              : 'Mark as a test account — skips Stripe, no real charges'
                          }
                        >
                          {togglingTest === u.uid ? '…' : u.isTest ? 'Untest' : 'Mark test'}
                        </button>
                        {deletable ? (
                          <button
                            type="button"
                            onClick={() => setPending([u.uid])}
                            className="text-xs text-gray-500 hover:text-red-400"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">
              Delete {pending.length} account{pending.length === 1 ? '' : 's'}?
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              This permanently removes{' '}
              {pending.length === 1 ? (
                <span className="text-white">{pendingNames[0]}</span>
              ) : (
                <span className="text-white">these accounts</span>
              )}{' '}
              and their login. This cannot be undone.
            </p>
            {hasResident ? (
              <p className="mt-2 text-sm text-gray-400">
                {hasStaff ? 'Residents in this list also lose ' : 'This also deletes '}
                <span className="text-white">all</span> their data — orders, bags, sticker sheets,
                processing records, pickups, transactions, and points.
              </p>
            ) : null}
            {hasStaff ? (
              <p className="mt-2 text-sm text-gray-400">
                Staff history (pickups, processing, completed routes) is preserved, but they&apos;ll
                be unassigned from any depot they manage and any active route.
              </p>
            ) : null}
            {pending.length > 1 ? (
              <ul className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-gray-400">
                {pendingNames.map((n, i) => (
                  <li key={i} className="px-1 py-0.5">
                    {n}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runDelete(pending)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-white/20 bg-white/10 text-white'
          : 'border-white/10 bg-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
    >
      {label}
      <span className={`ml-1.5 ${active ? 'text-gray-300' : 'text-gray-600'}`}>{count}</span>
    </button>
  );
}
