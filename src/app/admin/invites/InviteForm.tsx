'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { INVITABLE_ROLES, type InvitableRole } from '@/lib/types/role';
import type { ZoneDoc } from '@/lib/types/zone';
import type { DepotDoc } from '@/lib/types/depot';

const ROLE_LABELS: Record<InvitableRole, string> = {
  operator: 'Operator',
  depot_worker: 'Depot worker',
  depot_manager: 'Depot manager',
  admin: 'Admin',
};

interface Props {
  zones: ZoneDoc[];
  depots: DepotDoc[];
}

export function InviteForm({ zones, depots }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('operator');
  const [zoneId, setZoneId] = useState<string>('');
  const [depotId, setDepotId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          zoneId: zoneId || null,
          depotId: depotId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create invite.');
      } else {
        setResult({ url: json.url });
        setEmail('');
        setZoneId('');
        setDepotId('');
        router.refresh();
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  const showZone = role === 'operator';
  const showDepot = role === 'depot_worker' || role === 'depot_manager';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/10 bg-white/5 p-5"
    >
      <h2 className="text-sm font-semibold text-white">Send a new invite</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
            placeholder="person@example.com"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as InvitableRole)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        {showZone && (
          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Zone</span>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {showDepot && (
          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Depot</span>
            <select
              value={depotId}
              onChange={(e) => setDepotId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create invite'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      {result && (
        <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-xs">
          <div className="text-green-400">Invite created. Share this link:</div>
          <div className="mt-1 break-all font-mono text-white">{result.url}</div>
        </div>
      )}
    </form>
  );
}
