import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import type { RouteDoc } from '@/lib/types/route';
import type { ZoneDoc } from '@/lib/types/zone';
import type { AddressDoc, UserDoc } from '@/lib/types/user';

interface OrderRow {
  id: string;
  residentName: string;
  address: string;
  quantity: number;
  total: number;
  status: BagOrderDoc['status'];
  zoneName: string;
  operatorName: string;
  routeDate: string | null;
}

interface RouteGroup {
  routeId: string;
  date: string;
  zoneName: string;
  operatorName: string;
  orders: OrderRow[];
}

// Mon 00:00 → next Mon 00:00, in the server's local timezone. Good enough for a
// single-zone pilot — revisit if zones span timezones.
function thisWeekRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dow = start.getDay(); // 0 = Sun
  const daysFromMonday = (dow + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function formatDate(ts: Timestamp | null): string | null {
  if (!ts) return null;
  try {
    return ts.toDate().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

function formatAddress(a: AddressDoc | undefined): string {
  if (!a) return '—';
  const unit = a.unit ? ` ${a.unit}` : '';
  return `${a.street}${unit}, ${a.city}`;
}

function formatDollars(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

async function loadData() {
  const { start, end } = thisWeekRange();
  const startTs = Timestamp.fromDate(start);
  const endTs = Timestamp.fromDate(end);

  const [routesSnap, unassignedSnap, zonesSnap, operatorsSnap] = await Promise.all([
    adminDb
      .collection('routes')
      .where('date', '>=', startTs)
      .where('date', '<', endTs)
      .orderBy('date', 'desc')
      .get(),
    // Orders that are paid but not yet on a route — could be a backlog or just
    // ahead of next route build. Surfaced separately so the admin notices.
    adminDb
      .collection('bagOrders')
      .where('status', '==', 'queued')
      .where('deliveryRouteId', '==', null)
      .get(),
    adminDb.collection('zones').get(),
    adminDb.collection('users').where('role', '==', 'operator').get(),
  ]);

  const zoneNameById = new Map(zonesSnap.docs.map((d) => [d.id, (d.data() as ZoneDoc).name]));
  const opNameById = new Map(
    operatorsSnap.docs.map((d) => {
      const u = d.data() as UserDoc;
      return [u.uid, u.name || u.email || u.uid];
    }),
  );

  const routes = routesSnap.docs.map((d) => d.data() as RouteDoc);

  // Collect every bagOrder id that needs hydrating, plus addresses / residents
  // they reference. One pass means one fan-out batch read.
  const bagOrderIds = new Set<string>();
  for (const r of routes) for (const id of r.bagOrdersToDeliver) bagOrderIds.add(id);
  for (const d of unassignedSnap.docs) bagOrderIds.add(d.id);

  const bagOrderSnaps = bagOrderIds.size
    ? await adminDb.getAll(
        ...[...bagOrderIds].map((id) => adminDb.collection('bagOrders').doc(id)),
      )
    : [];
  const orderById = new Map<string, BagOrderDoc>();
  for (const s of bagOrderSnaps) if (s.exists) orderById.set(s.id, s.data() as BagOrderDoc);

  const addressIds = new Set<string>();
  const residentIds = new Set<string>();
  for (const o of orderById.values()) {
    addressIds.add(o.addressId);
    residentIds.add(o.residentId);
  }

  const [addressSnaps, residentSnaps] = await Promise.all([
    addressIds.size
      ? adminDb.getAll(...[...addressIds].map((id) => adminDb.collection('addresses').doc(id)))
      : Promise.resolve([]),
    residentIds.size
      ? adminDb.getAll(...[...residentIds].map((id) => adminDb.collection('users').doc(id)))
      : Promise.resolve([]),
  ]);
  const addressById = new Map<string, AddressDoc>();
  for (const s of addressSnaps) if (s.exists) addressById.set(s.id, s.data() as AddressDoc);
  const residentById = new Map<string, UserDoc>();
  for (const s of residentSnaps) if (s.exists) residentById.set(s.id, s.data() as UserDoc);

  const toRow = (
    order: BagOrderDoc,
    routeMeta?: { date: string | null; operatorName: string },
  ): OrderRow => ({
    id: order.id,
    residentName: residentById.get(order.residentId)?.name ?? order.residentId,
    address: formatAddress(addressById.get(order.addressId)),
    quantity: order.quantity,
    total: order.total,
    status: order.status,
    zoneName: order.zoneId ? (zoneNameById.get(order.zoneId) ?? order.zoneId) : '—',
    operatorName: routeMeta?.operatorName ?? '—',
    routeDate: routeMeta?.date ?? null,
  });

  const routeGroups: RouteGroup[] = routes.map((r) => {
    const operatorName = r.operatorId ? (opNameById.get(r.operatorId) ?? r.operatorId) : '—';
    const date = formatDate(r.date) ?? '—';
    const orders = r.bagOrdersToDeliver
      .map((id) => orderById.get(id))
      .filter((o): o is BagOrderDoc => Boolean(o))
      .map((o) => toRow(o, { date, operatorName }));
    return {
      routeId: r.id,
      date,
      zoneName: zoneNameById.get(r.zoneId) ?? r.zoneId,
      operatorName,
      orders,
    };
  });

  const unassigned: OrderRow[] = unassignedSnap.docs
    .map((d) => orderById.get(d.id))
    .filter((o): o is BagOrderDoc => Boolean(o))
    .map((o) => toRow(o));

  const weekLabel = `${start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} – ${new Date(end.getTime() - 1).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`;

  return { routeGroups, unassigned, weekLabel };
}

const STATUS_COLORS: Record<BagOrderDoc['status'], string> = {
  pending: 'border-gray-500/30 bg-gray-500/10 text-gray-300',
  queued: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  out_for_delivery: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  delivered: 'border-green-500/30 bg-green-500/10 text-green-300',
  cancelled: 'border-red-500/30 bg-red-500/10 text-red-300',
};

function StatusPill({ status }: { status: BagOrderDoc['status'] }) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_COLORS[status]}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function OrdersTable({ orders }: { orders: OrderRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-white/5 text-left text-[11px] uppercase tracking-wide text-gray-500">
        <tr>
          <th className="px-4 py-2 font-medium">Resident</th>
          <th className="px-4 py-2 font-medium">Address</th>
          <th className="px-4 py-2 font-medium">Bags</th>
          <th className="px-4 py-2 font-medium">Total</th>
          <th className="px-4 py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5 bg-black/20">
        {orders.map((o) => (
          <tr key={o.id} className="text-gray-200">
            <td className="px-4 py-2">{o.residentName}</td>
            <td className="px-4 py-2 text-gray-400">{o.address}</td>
            <td className="px-4 py-2">{o.quantity * 10}</td>
            <td className="px-4 py-2 text-gray-400">{formatDollars(o.total)}</td>
            <td className="px-4 py-2">
              <StatusPill status={o.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminOrdersPage() {
  const { routeGroups, unassigned, weekLabel } = await loadData();
  const totalOrders =
    routeGroups.reduce((acc, g) => acc + g.orders.length, 0) + unassigned.length;
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Orders this week</h1>
        <p className="mt-1 text-xs text-gray-500">
          {weekLabel} · {totalOrders} order{totalOrders === 1 ? '' : 's'} scheduled for delivery.
          Grouped by route — each route shows the operator, the day, and every bag order they will
          drop off.
        </p>
      </header>

      {routeGroups.length === 0 && unassigned.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-xs text-gray-500">
          No routes or queued orders for this week yet.
        </div>
      ) : null}

      <div className="space-y-6">
        {routeGroups.map((g) => (
          <section
            key={g.routeId}
            className="overflow-hidden rounded-xl border border-white/10"
          >
            <header className="flex items-baseline justify-between border-b border-white/10 bg-white/5 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  {g.date} · {g.zoneName}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                  Operator: {g.operatorName} · {g.orders.length} order
                  {g.orders.length === 1 ? '' : 's'}
                </div>
              </div>
            </header>
            {g.orders.length === 0 ? (
              <div className="bg-black/20 px-4 py-6 text-center text-xs text-gray-500">
                No bag orders on this route — pickup-only.
              </div>
            ) : (
              <OrdersTable orders={g.orders} />
            )}
          </section>
        ))}

        {unassigned.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-amber-500/30">
            <header className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <div className="text-sm font-semibold text-amber-200">
                Awaiting route assignment
              </div>
              <div className="text-[11px] uppercase tracking-wide text-amber-300/70">
                Paid orders without a delivery route — build a route to dispatch them.
              </div>
            </header>
            <OrdersTable orders={unassigned} />
          </section>
        )}
      </div>
    </div>
  );
}
