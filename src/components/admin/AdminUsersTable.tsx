'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface ResidentRow {
  uid: string;
  name: string;
  email: string | null;
  zoneName: string;
  pointsBalance: number;
  pointsValue: string;
}

export function AdminUsersTable({ residents }: { residents: ResidentRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Holds the uids queued for deletion while the confirm dialog is open.
  const [pending, setPending] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = residents.length > 0 && selected.size === residents.length;
  const byUid = new Map(residents.map((r) => [r.uid, r]));

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(residents.map((r) => r.uid)));
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

  const pendingNames =
    pending?.map((uid) => byUid.get(uid)?.name || byUid.get(uid)?.email || uid) ?? [];

  return (
    <div>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

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
            Delete {selected.size} resident{selected.size === 1 ? '' : 's'}
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
                  aria-label="Select all residents"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer accent-red-500"
                />
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 text-right font-medium">Points</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {residents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                  No residents yet.
                </td>
              </tr>
            ) : (
              residents.map((u) => (
                <tr
                  key={u.uid}
                  className={selected.has(u.uid) ? 'bg-white/5 text-gray-300' : 'text-gray-300'}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${u.name}`}
                      checked={selected.has(u.uid)}
                      onChange={() => toggle(u.uid)}
                      className="h-4 w-4 cursor-pointer accent-red-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-white">{u.name}</td>
                  <td className="px-4 py-3 text-gray-400">{u.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{u.zoneName}</td>
                  <td className="px-4 py-3 text-right text-white">
                    {u.pointsBalance.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">${u.pointsValue}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setPending([u.uid])}
                      className="text-xs text-gray-500 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">
              Delete {pending.length} resident{pending.length === 1 ? '' : 's'}?
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              This permanently deletes{' '}
              {pending.length === 1 ? (
                <span className="text-white">{pendingNames[0]}</span>
              ) : (
                <span className="text-white">these accounts</span>
              )}{' '}
              and <span className="text-white">all</span> their data — orders, bags, sticker sheets,
              processing records, pickups, transactions, points, and login. This cannot be undone.
            </p>
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
