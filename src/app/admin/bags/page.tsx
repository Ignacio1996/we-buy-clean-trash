import { adminDb } from '@/lib/firebase/admin';
import type { StickerSheetDoc } from '@/lib/types/bag';
import type { UserDoc } from '@/lib/types/user';
import { GuideLink } from '@/components/admin/GuideLink';
import { GenerateSheetButton } from './GenerateSheetButton';

interface SheetRow {
  id: string;
  sheetNumber: string;
  residentName: string | null;
  bagOrderId: string | null;
  printedAt: string | null;
  issuedAt: string | null;
  createdAt: string | null;
  state: 'unprinted' | 'printed_unassigned' | 'issued';
}

async function loadSheets(): Promise<SheetRow[]> {
  const snap = await adminDb
    .collection('stickerSheets')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const sheets = snap.docs.map((d) => d.data() as StickerSheetDoc);

  const residentIds = Array.from(
    new Set(sheets.map((s) => s.residentId).filter((id): id is string => !!id)),
  );
  const residents = new Map<string, string>();
  if (residentIds.length > 0) {
    const residentSnaps = await adminDb.getAll(
      ...residentIds.map((id) => adminDb.collection('users').doc(id)),
    );
    residentSnaps.forEach((r) => {
      if (r.exists) {
        const u = r.data() as UserDoc;
        residents.set(r.id, u.name ?? u.email ?? r.id);
      }
    });
  }

  return sheets.map((s) => {
    let state: SheetRow['state'];
    if (s.residentId) state = 'issued';
    else if (s.printedAt) state = 'printed_unassigned';
    else state = 'unprinted';
    return {
      id: s.id,
      sheetNumber: s.sheetNumber,
      residentName: s.residentId ? (residents.get(s.residentId) ?? s.residentId) : null,
      bagOrderId: s.bagOrderId,
      printedAt: s.printedAt?.toDate?.().toISOString() ?? null,
      issuedAt: s.issuedAt?.toDate?.().toISOString() ?? null,
      createdAt: s.createdAt?.toDate?.().toISOString() ?? null,
      state,
    };
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StateBadge({ state }: { state: SheetRow['state'] }) {
  const styles: Record<SheetRow['state'], string> = {
    unprinted: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    printed_unassigned: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    issued: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  };
  const labels: Record<SheetRow['state'], string> = {
    unprinted: 'Awaiting print',
    printed_unassigned: 'Printed · unassigned',
    issued: 'Issued',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[state]}`}
    >
      {labels[state]}
    </span>
  );
}

export default async function AdminBagsPage() {
  const sheets = await loadSheets();
  const unprintedCount = sheets.filter((s) => s.state === 'unprinted').length;
  const readyCount = sheets.filter((s) => s.state === 'printed_unassigned').length;

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Bag stickers</h1>
          <p className="mt-1 text-xs text-gray-500">
            Pre-print sticker sheets for Rollo thermal labels. Each sheet has 10 QR stickers with a
            printed number fallback. Operators scan the first sticker at delivery to claim the
            sheet for a resident.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GuideLink href="/user-guides/phase-10-qr-generation.html" />
          <GenerateSheetButton />
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Awaiting print" value={unprintedCount} tone="amber" />
        <Stat label="Ready to deliver" value={readyCount} tone="sky" />
        <Stat
          label="Issued"
          value={sheets.filter((s) => s.state === 'issued').length}
          tone="emerald"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Sheet #</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Resident</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">Printed</th>
              <th className="px-4 py-2.5 font-medium">Issued</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sheets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                  No sheets yet. Generate your first batch above.
                </td>
              </tr>
            ) : (
              sheets.map((s) => (
                <tr key={s.id} className="text-gray-300">
                  <td className="px-4 py-3 font-mono text-xs text-white">{s.sheetNumber}</td>
                  <td className="px-4 py-3">
                    <StateBadge state={s.state} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.residentName ?? <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(s.printedAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(s.issuedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/admin/bags/${s.id}/print`}
                      className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white hover:bg-white/10"
                    >
                      Print view
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'sky' | 'emerald';
}) {
  const tones: Record<typeof tone, string> = {
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
    sky: 'border-sky-500/20 bg-sky-500/5 text-sky-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
