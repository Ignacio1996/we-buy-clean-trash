import { adminDb } from './_admin';

async function main() {
  const snap = await adminDb.collection('bagOrders').orderBy('createdAt', 'desc').limit(50).get();
  console.log(`Found ${snap.size} bag order(s):\n`);
  for (const d of snap.docs) {
    const r = d.data() as Record<string, unknown>;
    const created = r.createdAt as { toDate?: () => Date } | undefined;
    const createdStr = created?.toDate ? created.toDate().toISOString() : '?';
    console.log(
      `${d.id}  status=${String(r.status).padEnd(10)}  qty=${r.quantity}  routeId=${r.deliveryRouteId ?? '(null)'}  created=${createdStr}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
