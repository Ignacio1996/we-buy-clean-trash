import { adminDb } from './_admin';

// One-shot diagnostic: list routes by (operatorId, zoneId, yyyy-mm-dd) and flag
// tuples that have more than one route doc. Used to investigate the "0 of 0
// bag orders" summary bug caused by duplicate routes.

async function main() {
  const snap = await adminDb.collection('routes').orderBy('createdAt', 'desc').limit(200).get();
  const byKey = new Map<
    string,
    { id: string; status: string; stops: number; bagOrders: number; createdAt: string }[]
  >();
  for (const d of snap.docs) {
    const r = d.data() as Record<string, unknown>;
    const operatorId = (r.operatorId as string | null) ?? '(none)';
    const zoneId = (r.zoneId as string) ?? '(none)';
    const date = r.date as { toDate?: () => Date } | undefined;
    const dateStr = date?.toDate ? date.toDate().toISOString().slice(0, 10) : '(no date)';
    const key = `${dateStr} | zone=${zoneId} | op=${operatorId}`;
    const created = r.createdAt as { toDate?: () => Date } | undefined;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push({
      id: d.id,
      status: r.status as string,
      stops: ((r.orderedStops as unknown[]) ?? []).length,
      bagOrders: ((r.bagOrdersToDeliver as unknown[]) ?? []).length,
      createdAt: created?.toDate ? created.toDate().toISOString() : '?',
    });
  }

  let dupeGroups = 0;
  for (const [key, rows] of byKey) {
    if (rows.length < 2) continue;
    dupeGroups += 1;
    console.log(`\n=== ${key} (${rows.length} routes) ===`);
    for (const r of rows) {
      console.log(
        `  ${r.id}  status=${r.status.padEnd(11)} stops=${String(r.stops).padStart(2)}  bagOrders=${String(r.bagOrders).padStart(2)}  createdAt=${r.createdAt}`,
      );
    }
  }
  if (dupeGroups === 0) {
    console.log('No duplicate (operator, zone, date) tuples in the last 200 routes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
