import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_admin';

interface Seed {
  id: string;
  name: string;
  marketPrice: number;
  customerPct: number;
}

const SEEDS: Seed[] = [
  { id: 'aluminum', name: 'Aluminum', marketPrice: 0.92, customerPct: 0.3 },
  { id: 'tin_steel', name: 'Tin / Steel', marketPrice: 0.14, customerPct: 0.3 },
  { id: 'cardboard', name: 'Cardboard', marketPrice: 0.08, customerPct: 0.3 },
  { id: 'paper', name: 'Paper', marketPrice: 0.05, customerPct: 0.3 },
  { id: 'pet', name: 'PET', marketPrice: 0.23, customerPct: 0.3 },
  { id: 'hdpe', name: 'HDPE', marketPrice: 0.1, customerPct: 0.3 },
  { id: 'mixed_plastic', name: 'Mixed Plastic', marketPrice: 0.05, customerPct: 0.3 },
];

async function main() {
  const force = process.argv.includes('--force');
  const now = FieldValue.serverTimestamp();

  for (const seed of SEEDS) {
    const ref = adminDb.collection('materials').doc(seed.id);
    const snap = await ref.get();
    if (snap.exists && !force) {
      console.log(`· ${seed.id} exists — skipping (pass --force to overwrite)`);
      continue;
    }
    await ref.set({
      id: seed.id,
      name: seed.name,
      marketPrice: seed.marketPrice,
      customerPct: seed.customerPct,
      updatedAt: now,
      updatedBy: 'seed-script',
    });
    console.log(
      `✓ wrote materials/${seed.id} @ $${seed.marketPrice}/unit, ${seed.customerPct * 100}% payout`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
