'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { INVITABLE_ROLES, type InvitableRole } from '@/lib/types/role';
import type { ZoneDoc } from '@/lib/types/zone';
import type { DepotDoc } from '@/lib/types/depot';

type ZoneView = Omit<ZoneDoc, 'createdAt'>;
type DepotView = Omit<DepotDoc, 'createdAt' | 'updatedAt'>;

const ROLE_LABELS: Record<InvitableRole, string> = {
  operator: 'Operator',
  depot_worker: 'Depot worker',
  depot_manager: 'Depot manager',
  program_manager: 'Program manager (compost)',
  admin: 'Admin',
};

type Channel = 'email' | 'phone' | 'both';

interface Delivery {
  channel: 'email' | 'sms';
  ok: boolean;
  error?: string;
}

interface Props {
  zones: ZoneView[];
  depots: DepotView[];
}

export function InviteForm({ zones, depots }: Props) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<InvitableRole>('operator');
  const [zoneId, setZoneId] = useState<string>('');
  const [depotId, setDepotId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; deliveries: Delivery[] } | null>(null);
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
          email: channel === 'phone' ? null : email,
          phone: channel === 'email' ? null : phone,
          role,
          zoneId: zoneId || null,
          depotId: depotId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create invite.');
      } else {
        setResult({ url: json.url, deliveries: json.deliveries ?? [] });
        setEmail('');
        setPhone('');
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

  const showEmail = channel === 'email' || channel === 'both';
  const showPhone = channel === 'phone' || channel === 'both';
  const showZone = role === 'operator' || role === 'program_manager';
  const showDepot = role === 'depot_worker' || role === 'depot_manager';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/10 bg-white/5 p-5"
    >
      <h2 className="text-sm font-semibold text-white">Send a new invite</h2>
      <p className="mt-1 text-[11px] text-gray-500">
        The join link is sent automatically through the selected channel.
      </p>
      <div className="mt-4 flex gap-2 text-xs">
        {(['email', 'phone', 'both'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannel(c)}
            className={`rounded-lg border px-3 py-1.5 ${
              channel === c
                ? 'border-white bg-white text-black'
                : 'border-white/15 text-gray-300 hover:bg-white/10'
            }`}
          >
            {c === 'email' ? 'Email' : c === 'phone' ? 'Phone' : 'Both'}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {showEmail && (
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Email</span>
            <input
              required={showEmail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
              placeholder="person@example.com"
            />
          </label>
        )}
        {showPhone && (
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Phone</span>
            <input
              required={showPhone}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
              placeholder="+15551234567"
            />
          </label>
        )}
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
          {busy ? 'Sending…' : 'Send invite'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      {result && (
        <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-xs">
          <div className="text-green-400">Invite created and sent.</div>
          {result.deliveries.map((d) => (
            <div
              key={d.channel}
              className={`mt-1 ${d.ok ? 'text-green-300' : 'text-red-400'}`}
            >
              {d.channel === 'email' ? 'Email' : 'SMS'}:{' '}
              {d.ok ? 'queued ✓' : `failed — ${d.error ?? 'unknown error'}`}
            </div>
          ))}
          <div className="mt-2 text-gray-400">Share link manually if needed:</div>
          <div className="mt-1 break-all font-mono text-white">{result.url}</div>
        </div>
      )}
    </form>
  );
}
