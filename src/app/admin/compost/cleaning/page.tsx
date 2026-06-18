import { adminDb } from '@/lib/firebase/admin';
import type { CleaningTicketDoc } from '@/lib/types/cleaningTicket';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { columbusDateLabel } from '@/lib/logic/columbusDate';
import { MarkCleanedButton } from './MarkCleanedButton';

interface SiteQueueRow {
  commercialAccountId: string;
  siteName: string;
  count: number;
  lastFlaggedLabel: string;
  lastFlaggedMs: number;
}

async function loadQueue(): Promise<SiteQueueRow[]> {
  const snap = await adminDb
    .collection('cleaningTickets')
    .where('status', '==', 'open')
    .get();
  const tickets = snap.docs.map((d) => d.data() as CleaningTicketDoc);

  // Group open tickets by site — cleaning happens per site, not per bin.
  const bySite = new Map<string, { count: number; lastMs: number }>();
  for (const t of tickets) {
    const ms = t.flaggedAt?.toMillis?.() ?? 0;
    const cur = bySite.get(t.commercialAccountId);
    if (cur) {
      cur.count += 1;
      cur.lastMs = Math.max(cur.lastMs, ms);
    } else {
      bySite.set(t.commercialAccountId, { count: 1, lastMs: ms });
    }
  }

  const siteIds = [...bySite.keys()];
  const siteNames = new Map<string, string>();
  if (siteIds.length > 0) {
    const siteSnaps = await adminDb.getAll(
      ...siteIds.map((id) => adminDb.collection('commercialAccounts').doc(id)),
    );
    for (const s of siteSnaps) {
      if (s.exists) siteNames.set(s.id, (s.data() as CommercialAccountDoc).businessName);
    }
  }

  return [...bySite.entries()]
    .map(([commercialAccountId, info]) => ({
      commercialAccountId,
      siteName: siteNames.get(commercialAccountId) ?? commercialAccountId,
      count: info.count,
      lastFlaggedLabel: info.lastMs > 0 ? columbusDateLabel(new Date(info.lastMs)) : '—',
      lastFlaggedMs: info.lastMs,
    }))
    .sort((a, b) => b.lastFlaggedMs - a.lastFlaggedMs);
}

export default async function CompostCleaningPage() {
  const queue = await loadQueue();

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Compost · Tia
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Cleaning queue</h1>
        <p className="mt-1 text-xs text-gray-500">
          Sites a driver flagged for cleaning on the route. Schedule the cart-cleaning truck, then
          mark the site cleaned to clear it. One tap closes every open flag for the site.
        </p>
      </header>

      {queue.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
          Nothing to clean. Sites appear here when a driver toggles{' '}
          <span className="font-semibold text-gray-200">Bin(s) need cleaning</span> on a stop.
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((row) => (
            <div
              key={row.commercialAccountId}
              className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
            >
              <div>
                <div className="font-semibold text-white">{row.siteName}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">
                  {row.count} open flag{row.count === 1 ? '' : 's'} · last {row.lastFlaggedLabel}
                </div>
              </div>
              <MarkCleanedButton
                commercialAccountId={row.commercialAccountId}
                count={row.count}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
