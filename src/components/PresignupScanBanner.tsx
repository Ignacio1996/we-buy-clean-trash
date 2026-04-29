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
    <div className="rounded-[14px] border border-[rgba(160,104,42,0.3)] bg-[#F2E8D6] px-4 py-3.5">
      <div
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 15,
          fontWeight: 500,
          color: '#A0682A',
          letterSpacing: -0.2,
        }}
      >
        You scanned {count} item{count === 1 ? '' : 's'} worth ${scan.totalDollars.toFixed(2)} ·{' '}
        {formatPoints(scan.totalPoints)} pts
      </div>
      <div className="mt-1" style={{ fontSize: 12, color: '#A0682A', opacity: 0.85 }}>
        Finish signing up and this is the kind of earning you&rsquo;re on track for.
      </div>
    </div>
  );
}
