'use client';

import { useSyncExternalStore } from 'react';
import { getPresignupScanSnapshot } from '@/lib/presignup/scan-storage';
import { SS } from '@/components/resident/ss/SS';

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
    <div
      style={{
        background: SS.mint,
        border: `2px solid ${SS.ink}`,
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: `0 4px 0 ${SS.ink}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: SS.green,
          marginBottom: 4,
        }}
      >
        From your scan
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: SS.ink, letterSpacing: -0.3 }}>
        {count} item{count === 1 ? '' : 's'} · ${scan.totalDollars.toFixed(2)} ·{' '}
        {formatPoints(scan.totalPoints)} pts
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: SS.inkSoft, marginTop: 4 }}>
        Finish signing up and this is the kind of earning you&rsquo;re on track for.
      </div>
    </div>
  );
}
