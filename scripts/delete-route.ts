import { adminDb } from './_admin';

// Admin-side route deletion with the same safety as /api/admin/routes/[id]:
// refuses if any linked pickup is completed/missed/issue or any bag order is
// delivered. Releases pending pickups and queued bag orders.
//
// Usage:
//   npm run delete-route -- <routeId> [<routeId> ...] [--apply]

const PICKUP_TERMINAL = new Set(['completed', 'missed', 'issue']);
const BAG_ORDER_TERMINAL = new Set(['delivered']);

async function deleteOne(routeId: string, apply: boolean): Promise<void> {
  const routeRef = adminDb.collection('routes').doc(routeId);
  const routeSnap = await routeRef.get();
  if (!routeSnap.exists) {
    console.log(`✗ ${routeId} : route_not_found`);
    return;
  }
  const route = routeSnap.data() as Record<string, unknown>;
  const stops = (route.orderedStops as { pickupId: string | null }[] | undefined) ?? [];
  const bagOrders = (route.bagOrdersToDeliver as string[] | undefined) ?? [];
  const status = route.status as string;

  const pickupRefs = stops
    .map((s) => s.pickupId)
    .filter((id): id is string => id !== null)
    .map((id) => adminDb.collection('pickups').doc(id));
  const bagOrderRefs = bagOrders.map((id) => adminDb.collection('bagOrders').doc(id));

  const [pickupSnaps, bagOrderSnaps] = await Promise.all([
    pickupRefs.length ? adminDb.getAll(...pickupRefs) : Promise.resolve([]),
    bagOrderRefs.length ? adminDb.getAll(...bagOrderRefs) : Promise.resolve([]),
  ]);

  const finishedPickup = pickupSnaps.find(
    (s) => s.exists && PICKUP_TERMINAL.has(s.get('status')),
  );
  const finishedBagOrder = bagOrderSnaps.find(
    (s) => s.exists && BAG_ORDER_TERMINAL.has(s.get('status')),
  );
  if (finishedPickup || finishedBagOrder) {
    console.log(
      `✗ ${routeId} (${status}) : route_has_finished_work — refusing to delete`,
    );
    if (finishedPickup) console.log(`    pickup ${finishedPickup.id} status=${finishedPickup.get('status')}`);
    if (finishedBagOrder)
      console.log(`    bagOrder ${finishedBagOrder.id} status=${finishedBagOrder.get('status')}`);
    return;
  }

  const releasedPickups = pickupSnaps.filter(
    (s) => s.exists && s.get('routeId') === routeId,
  );
  const releasedBagOrders = bagOrderSnaps.filter(
    (s) => s.exists && s.get('deliveryRouteId') === routeId,
  );

  console.log(
    `→ ${routeId} (${status}) : releasing ${releasedPickups.length} pickup(s), ${releasedBagOrders.length} bag order(s), then delete`,
  );
  for (const s of releasedPickups) console.log(`    pickup ${s.id} → routeId=null, operatorId=null`);
  for (const s of releasedBagOrders) console.log(`    bagOrder ${s.id} → deliveryRouteId=null`);

  if (!apply) return;

  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(routeRef);
    if (!fresh.exists) return;
    const freshPickups = pickupRefs.length ? await tx.getAll(...pickupRefs) : [];
    const freshBagOrders = bagOrderRefs.length ? await tx.getAll(...bagOrderRefs) : [];
    if (
      freshPickups.find((s) => s.exists && PICKUP_TERMINAL.has(s.get('status'))) ||
      freshBagOrders.find((s) => s.exists && BAG_ORDER_TERMINAL.has(s.get('status')))
    ) {
      throw new Error('route_has_finished_work_at_apply');
    }
    for (const s of freshPickups) {
      if (!s.exists) continue;
      if (s.get('routeId') !== routeId) continue;
      tx.update(s.ref, { routeId: null, operatorId: null });
    }
    for (const s of freshBagOrders) {
      if (!s.exists) continue;
      if (s.get('deliveryRouteId') !== routeId) continue;
      tx.update(s.ref, { deliveryRouteId: null });
    }
    tx.delete(routeRef);
  });
  console.log(`✓ ${routeId} deleted.`);
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const ids = argv.filter((a) => !a.startsWith('--'));
  if (ids.length === 0) {
    console.error('Usage: npm run delete-route -- <routeId> [<routeId> ...] [--apply]');
    process.exit(1);
  }
  for (const id of ids) {
    await deleteOne(id, apply);
  }
  if (!apply) console.log('\n(dry run) re-run with --apply to write.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
