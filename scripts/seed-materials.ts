import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_admin';
import type { PayoutMode, MeasurementMode } from '../src/lib/types/material';

interface Seed {
  id: string;
  name: string;
  marketPrice: number;
  customerPct: number;
  payoutMode: PayoutMode;
  measurementMode: MeasurementMode;
}

const SEEDS: Seed[] = [
  // Cash-paying recyclables — the canonical 7.
  { id: 'aluminum', name: 'Aluminum', marketPrice: 0.92, customerPct: 0.3, payoutMode: 'cash', measurementMode: 'bag_weight' },
  { id: 'tin_steel', name: 'Tin / Steel', marketPrice: 0.14, customerPct: 0.3, payoutMode: 'cash', measurementMode: 'bag_weight' },
  { id: 'cardboard', name: 'Cardboard', marketPrice: 0.08, customerPct: 0.3, payoutMode: 'cash', measurementMode: 'bag_weight' },
  { id: 'paper', name: 'Paper', marketPrice: 0.05, customerPct: 0.3, payoutMode: 'cash', measurementMode: 'bag_weight' },
  { id: 'pet', name: 'PET', marketPrice: 0.23, customerPct: 0.3, payoutMode: 'cash', measurementMode: 'bag_weight' },
  { id: 'hdpe', name: 'HDPE', marketPrice: 0.1, customerPct: 0.3, payoutMode: 'cash', measurementMode: 'bag_weight' },
  { id: 'mixed_plastic', name: 'Mixed Plastic', marketPrice: 0.05, customerPct: 0.3, payoutMode: 'cash', measurementMode: 'bag_weight' },
  // Diversion-only — weight tracked for reporting, no points awarded. Used for
  // commingled bags (no separation = no payout) and Compost Clubhouse pickups.
  { id: 'commingled', name: 'Commingled', marketPrice: 0, customerPct: 0, payoutMode: 'diversion_only', measurementMode: 'bag_weight' },
  { id: 'food_scrap', name: 'Food Scrap (Compost)', marketPrice: 0, customerPct: 0, payoutMode: 'diversion_only', measurementMode: 'bin_fullness' },
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
      payoutMode: seed.payoutMode,
      measurementMode: seed.measurementMode,
      active: true,
      displayOrder: SEEDS.indexOf(seed),
      updatedAt: now,
      updatedBy: 'seed-script',
    });
    console.log(
      `✓ wrote materials/${seed.id} [${seed.payoutMode}/${seed.measurementMode}] @ $${seed.marketPrice}/unit, ${seed.customerPct * 100}% payout`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
