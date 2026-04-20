'use client';

import { useSyncExternalStore } from 'react';
import { getPresignupScanSnapshot } from '@/lib/presignup/scan-storage';

function formatPoints(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}

const noopSubscribe = () => () => {};
const serverSnapshot = () => null;

export function PresignupScanBanner() {
  const scan = useSyncExternalStore(noopSubscribe, getPresignupScanSnapshot, serverSnapshot);

  if (!scan) return null;

  const count = scan.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
      <div className="font-semibold text-green-200">
        You scanned {count} item{count === 1 ? '' : 's'} worth ${scan.totalDollars.toFixed(2)} ·{' '}
        {formatPoints(scan.totalPoints)} pts
      </div>
      <div className="mt-0.5 text-xs text-green-300/80">
        Finish signing up and this is the kind of earning you&rsquo;re on track for.
      </div>
    </div>
  );
}
