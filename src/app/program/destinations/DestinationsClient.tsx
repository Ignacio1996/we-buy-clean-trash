'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface DestinationView {
  id: string;
  name: string;
  zoneId: string;
  contactName: string | null;
  contactPhone: string | null;
  smsEnabled: boolean;
  active: boolean;
}

interface ZoneOption {
  id: string;
  name: string;
}

export function DestinationsClient({
  destinations,
  zones,
}: {
  destinations: DestinationView[];
  zones: ZoneOption[];
}) {
  const active = destinations.filter((d) => d.active);
  const archived = destinations.filter((d) => !d.active);

  return (
    <div className="space-y-6">
      <NewDestinationForm zones={zones} />

      <section>
        <h2 className="text-sm font-semibold text-white">Destinations · {active.length}</h2>
        <div className="mt-3 space-y-3">
          {active.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-gray-500">
              No destinations yet. Add Alum Creek / London above.
            </div>
          ) : (
            active.map((d) => <DestinationCard key={d.id} dest={d} zones={zones} />)
          )}
        </div>
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-gray-500">
            Archived · {archived.length}
          </h2>
          <div className="mt-2 space-y-2">
            {archived.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-gray-500"
              >
                {d.name}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DestinationCard({ dest, zones }: { dest: DestinationView; zones: ZoneOption[] }) {
  const router = useRouter();
  const zoneName = zones.find((z) => z.id === dest.zoneId)?.name ?? dest.zoneId;
  const [editing, setEditing] = useState(false);
  const [contactName, setContactName] = useState(dest.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(dest.contactPhone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/compost/destinations/${dest.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === 'string' ? j.error : 'update_failed');
      return false;
    }
    router.refresh();
    return true;
  }

  async function toggleSms() {
    // Turning SMS on with no number on file would 400 — guard in the UI.
    if (!dest.smsEnabled && !dest.contactPhone && !contactPhone.trim()) {
      setError('Add a contact phone before enabling texts.');
      setEditing(true);
      return;
    }
    await patch({ smsEnabled: !dest.smsEnabled });
  }

  async function saveContact() {
    const ok = await patch({
      contactName: contactName.trim() || null,
      contactPhone: contactPhone.trim() || null,
    });
    if (ok) setEditing(false);
  }

  async function archive() {
    if (!confirm(`Archive ${dest.name}?`)) return;
    await patch({ active: false });
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{dest.name}</h3>
          <div className="mt-0.5 text-xs text-gray-400">
            {dest.contactName || 'No contact name'}
            {dest.contactPhone ? ` · ${dest.contactPhone}` : ' · no phone'}
          </div>
          <div className="mt-0.5 text-[11px] text-gray-500">Zone: {zoneName}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            disabled={busy}
            className="rounded border border-white/15 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/10 disabled:opacity-50"
          >
            {editing ? 'Close' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={archive}
            disabled={busy}
            className="rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            Archive
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
        <div>
          <div className="text-xs font-medium text-white">Text facility when on the way</div>
          <div className="text-[11px] text-gray-500">
            {dest.smsEnabled
              ? 'On — the contact gets an SMS when the route heads here.'
              : 'Off — no automatic text to this facility.'}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSms}
          disabled={busy}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-50 ${
            dest.smsEnabled
              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
              : 'bg-white/5 text-gray-400 border border-white/15'
          }`}
        >
          {dest.smsEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Contact name</span>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Contact phone</span>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+15551234567"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={saveContact}
              disabled={busy}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save contact'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function NewDestinationForm({ zones }: { zones: ZoneOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    zoneId: zones[0]?.id ?? '',
    contactName: '',
    contactPhone: '',
    smsEnabled: false,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.smsEnabled && !form.contactPhone.trim()) {
      setError('Add a contact phone before enabling texts.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch('/api/compost/destinations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        zoneId: form.zoneId,
        contactName: form.contactName.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        smsEnabled: form.smsEnabled,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === 'string' ? j.error : 'create_failed');
      return;
    }
    setOpen(false);
    setForm((f) => ({ ...f, name: '', contactName: '', contactPhone: '', smsEnabled: false }));
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
        {zones.length === 0 ? 'Create a zone first' : '+ Add destination'}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">New destination</div>
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
        <label className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Alum Creek"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600"
          />
        </label>
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
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Contact name</span>
          <input
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Contact phone</span>
          <input
            value={form.contactPhone}
            onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            placeholder="+15551234567"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600"
          />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={form.smsEnabled}
            onChange={(e) => setForm((f) => ({ ...f, smsEnabled: e.target.checked }))}
          />
          <span className="text-xs text-gray-300">Text this facility when the route is on the way</span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Create destination'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </form>
  );
}
