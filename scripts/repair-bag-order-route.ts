import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_admin';

// Repair for the duplicate-route bug: a bag order ended up pinned to a route
// whose bagOrdersToDeliver array doesn't contain it, so the operator summary
// reads 0/0. This script repoints the order's deliveryRouteId (when needed)
// and reconciles the bagOrdersToDeliver arrays on the affected routes.
//
// Usage:
//   # scan: list every delivered order missing from its route's array
//   npm run repair:bag-order-route -- --scan
//   # scan + fix all
//   npm run repair:bag-order-route -- --scan --apply
//   # repair a single order against a specific route
//   npm run repair:bag-order-route -- --orderId <id> --routeId <id> [--apply]

interface Args {
  orderId?: string;
  routeId?: string;
  apply: boolean;
  scan: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { apply: false, scan: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--orderId') out.orderId = argv[++i];
    else if (a === '--routeId') out.routeId = argv[++i];
    else if (a === '--apply') out.apply = true;
    else if (a === '--scan') out.scan = true;
  }
  if (!out.scan && (!out.orderId || !out.routeId)) {
    console.error(
      'Usage:\n' +
        '  npm run repair:bag-order-route -- --scan [--apply]\n' +
        '  npm run repair:bag-order-route -- --orderId <id> --routeId <id> [--apply]',
    );
    process.exit(1);
  }
  return out;
}

async function scanAndRepair(apply: boolean) {
  const ordersSnap = await adminDb
    .collection('bagOrders')
    .where('status', '==', 'delivered')
    .get();
  console.log(`Scanning ${ordersSnap.size} delivered bag order(s)…\n`);

  const inconsistent: { orderId: string; routeId: string }[] = [];
  for (const doc of ordersSnap.docs) {
    const orderId = doc.id;
    const routeId = (doc.get('deliveryRouteId') as string | null) ?? null;
    if (!routeId) {
      console.log(`! ${orderId} : delivered but deliveryRouteId is null (skip)`);
      continue;
    }
    const routeSnap = await adminDb.collection('routes').doc(routeId).get();
    if (!routeSnap.exists) {
      console.log(`! ${orderId} : deliveryRouteId ${routeId} does not exist (skip)`);
      continue;
    }
    const arr = (routeSnap.get('bagOrdersToDeliver') as string[] | undefined) ?? [];
    if (arr.includes(orderId)) continue;
    inconsistent.push({ orderId, routeId });
    console.log(`✗ ${orderId} : missing from routes/${routeId}.bagOrdersToDeliver`);
  }

  if (inconsistent.length === 0) {
    console.log('\n✓ all delivered orders are consistent.');
    return;
  }

  console.log(`\nFound ${inconsistent.length} inconsistency(ies).`);
  if (!apply) {
    console.log('(dry run) re-run with --scan --apply to fix.');
    return;
  }

  for (const { orderId, routeId } of inconsistent) {
    const routeRef = adminDb.collection('routes').doc(routeId);
    await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(routeRef);
      if (!fresh.exists) return;
      const arr = (fresh.get('bagOrdersToDeliver') as string[] | undefined) ?? [];
      if (arr.includes(orderId)) return;
      tx.update(routeRef, { bagOrdersToDeliver: FieldValue.arrayUnion(orderId) });
    });
    console.log(`✓ added ${orderId} to routes/${routeId}.bagOrdersToDeliver`);
  }
}

async function main() {
  const args = parseArgs();
  if (args.scan) {
    await scanAndRepair(args.apply);
    return;
  }
  const orderId = args.orderId!;
  const routeId = args.routeId!;
  const apply = args.apply;

  const orderRef = adminDb.collection('bagOrders').doc(orderId);
  const targetRouteRef = adminDb.collection('routes').doc(routeId);

  const [orderSnap, targetSnap] = await Promise.all([orderRef.get(), targetRouteRef.get()]);
  if (!orderSnap.exists) throw new Error(`bag order not found: ${orderId}`);
  if (!targetSnap.exists) throw new Error(`target route not found: ${routeId}`);

  const order = orderSnap.data() as Record<string, unknown>;
  const target = targetSnap.data() as Record<string, unknown>;
  const oldRouteId = (order.deliveryRouteId as string | null) ?? null;
  const orderStatus = order.status as string;
  const targetStatus = target.status as string;
  const targetBagOrders = (target.bagOrdersToDeliver as string[] | undefined) ?? [];

  console.log('Bag order');
  console.log('  id              :', orderId);
  console.log('  status          :', orderStatus);
  console.log('  deliveryRouteId :', oldRouteId ?? '(null)');
  console.log('Target route');
  console.log('  id              :', routeId);
  console.log('  status          :', targetStatus);
  console.log('  bagOrdersToDeliver count :', targetBagOrders.length);
  console.log('  has this order? :', targetBagOrders.includes(orderId));

  if (oldRouteId === routeId && targetBagOrders.includes(orderId)) {
    console.log('\n✓ already consistent — nothing to repair.');
    return;
  }
  if (targetStatus !== 'in_progress' && targetStatus !== 'completed') {
    throw new Error(
      `target route status is "${targetStatus}" — repair only repoints to a worked route (in_progress or completed)`,
    );
  }

  let oldRouteHasOrder = false;
  if (oldRouteId && oldRouteId !== routeId) {
    const oldSnap = await adminDb.collection('routes').doc(oldRouteId).get();
    if (oldSnap.exists) {
      const oldArr = (oldSnap.get('bagOrdersToDeliver') as string[] | undefined) ?? [];
      oldRouteHasOrder = oldArr.includes(orderId);
      console.log('Old route');
      console.log('  id              :', oldRouteId);
      console.log('  status          :', oldSnap.get('status'));
      console.log('  has this order? :', oldRouteHasOrder);
    } else {
      console.log('Old route', oldRouteId, '→ does not exist (was deleted).');
    }
  }

  console.log('\nPlanned changes:');
  if (oldRouteId !== routeId) {
    console.log(`  bagOrders/${orderId}.deliveryRouteId : ${oldRouteId ?? '(null)'} → ${routeId}`);
  }
  if (!targetBagOrders.includes(orderId)) {
    console.log(`  routes/${routeId}.bagOrdersToDeliver : arrayUnion(${orderId})`);
  }
  if (oldRouteHasOrder && oldRouteId) {
    console.log(`  routes/${oldRouteId}.bagOrdersToDeliver : arrayRemove(${orderId})`);
  }

  if (!apply) {
    console.log('\n(dry run) re-run with --apply to write.');
    return;
  }

  await adminDb.runTransaction(async (tx) => {
    // Re-read to ensure nothing changed underneath us.
    const freshOrder = await tx.get(orderRef);
    const freshTarget = await tx.get(targetRouteRef);
    if (!freshOrder.exists) throw new Error('order disappeared');
    if (!freshTarget.exists) throw new Error('target route disappeared');
    const oldRef = oldRouteId ? adminDb.collection('routes').doc(oldRouteId) : null;
    const oldSnap = oldRef ? await tx.get(oldRef) : null;

    if (freshOrder.get('deliveryRouteId') !== routeId) {
      tx.update(orderRef, { deliveryRouteId: routeId });
    }
    const freshTargetArr =
      (freshTarget.get('bagOrdersToDeliver') as string[] | undefined) ?? [];
    if (!freshTargetArr.includes(orderId)) {
      tx.update(targetRouteRef, {
        bagOrdersToDeliver: FieldValue.arrayUnion(orderId),
      });
    }
    if (oldRef && oldSnap?.exists && oldRef.id !== routeId) {
      const oldArr = (oldSnap.get('bagOrdersToDeliver') as string[] | undefined) ?? [];
      if (oldArr.includes(orderId)) {
        tx.update(oldRef, { bagOrdersToDeliver: FieldValue.arrayRemove(orderId) });
      }
    }
  });

  console.log('\n✓ repair applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
