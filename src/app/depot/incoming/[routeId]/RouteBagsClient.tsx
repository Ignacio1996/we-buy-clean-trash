'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { QrScanner } from '@/components/scanner/QrScanner';
import type { BagStatus, DeclaredBagType } from '@/lib/types/bag';

export interface RouteBagRow {
  bagId: string;
  printedNumber: string;
  qrCode: string;
  residentName: string;
  declaredType: DeclaredBagType | null;
  status: BagStatus;
}

export function RouteBagsClient({ rows }: { rows: RouteBagRow[] }) {
  const router = useRouter();
  const [scanMode, setScanMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const index = useMemo(() => {
    const byCode = new Map<string, RouteBagRow>();
    const byNumber = new Map<string, RouteBagRow>();
    rows.forEach((r) => {
      byCode.set(r.qrCode.trim().toUpperCase(), r);
      byNumber.set(r.printedNumber.trim().toUpperCase(), r);
    });
    return { byCode, byNumber };
  }, [rows]);

  function handleDetected(value: string) {
    const key = value.trim().toUpperCase();
    const match = index.byCode.get(key) ?? index.byNumber.get(key);
    if (!match) {
      setError(`"${value}" isn’t a bag from this route. Try again or tap a bag below.`);
      setScanMode(false);
      return;
    }
    if (match.status === 'processed') {
      setError(`Bag ${match.printedNumber} is already processed.`);
      setScanMode(false);
      return;
    }
    router.push(`/depot/process/${match.bagId}`);
  }

  return (
    <div className="mt-5 space-y-4">
      {scanMode ? (
        <QrScanner
          onDetected={handleDetected}
          scanInstructions="📷 Point at the bag QR"
          manualPlaceholder="Or type the printed number"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setScanMode(true);
          }}
          className="w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-black"
        >
          📷 Scan a bag
        </button>
      )}

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {rows.map((row) => {
          const processed = row.status === 'processed';
          return (
            <li key={row.bagId}>
              <Link
                href={processed ? '#' : `/depot/process/${row.bagId}`}
                onClick={(e) => {
                  if (processed) e.preventDefault();
                }}
                className={`flex items-center justify-between rounded-lg border border-white/10 px-3 py-3 text-sm ${
                  processed ? 'cursor-not-allowed bg-white/5 opacity-60' : 'bg-black/30 hover:bg-white/10'
                }`}
              >
                <div>
                  <div className="font-mono text-xs text-white">#{row.printedNumber}</div>
                  <div className="mt-0.5 text-xs text-gray-300">{row.residentName}</div>
                  {row.declaredType && (
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      Declared {row.declaredType === 'separated' ? 'separated' : 'mixed'}
                    </div>
                  )}
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    processed ? 'bg-white/5 text-gray-500' : 'bg-white text-black'
                  }`}
                >
                  {processed ? 'Processed' : 'Pending'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
