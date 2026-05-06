'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { QrScanner } from '@/components/scanner/QrScanner';
import {
  DP_TOK,
  DpAlert,
  DpPrimaryButton,
  DpStatusPill,
} from '@/components/depot/Dp';
import { IconScan } from '@/components/icons/EcoIcons';
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
      setError(`Bag #${match.printedNumber} is already processed.`);
      setScanMode(false);
      return;
    }
    router.push(`/depot/process/${match.bagId}`);
  }

  return (
    <div className="space-y-4">
      {scanMode ? (
        <QrScanner
          onDetected={handleDetected}
          scanInstructions="📷 Point at the bag QR"
          manualPlaceholder="Or type the printed number"
        />
      ) : (
        <DpPrimaryButton
          onClick={() => {
            setError(null);
            setScanMode(true);
          }}
        >
          <IconScan size={18} color={DP_TOK.paper} stroke={1.5} />
          Scan a bag
        </DpPrimaryButton>
      )}

      {error && <DpAlert tone="rust">{error}</DpAlert>}

      <ul className="space-y-2.5">
        {rows.map((row) => {
          const processed = row.status === 'processed';
          return (
            <li key={row.bagId}>
              <Link
                href={processed ? '#' : `/depot/process/${row.bagId}`}
                onClick={(e) => {
                  if (processed) e.preventDefault();
                }}
                className="flex items-center justify-between transition-opacity"
                style={{
                  background: DP_TOK.paper,
                  border: `1px solid ${DP_TOK.line}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  textDecoration: 'none',
                  color: DP_TOK.ink,
                  opacity: processed ? 0.6 : 1,
                  cursor: processed ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="min-w-0">
                  <div
                    style={{
                      fontFamily: DP_TOK.mono,
                      fontSize: 13,
                      color: DP_TOK.ink,
                      letterSpacing: 0.5,
                    }}
                  >
                    #{row.printedNumber}
                  </div>
                  <div
                    className="mt-0.5"
                    style={{ fontFamily: DP_TOK.serif, fontSize: 13, color: DP_TOK.ink }}
                  >
                    {row.residentName}
                  </div>
                  {row.declaredType && (
                    <div
                      className="mt-0.5 italic"
                      style={{
                        fontFamily: DP_TOK.serif,
                        fontSize: 11,
                        color: DP_TOK.inkSoft,
                      }}
                    >
                      Declared{' '}
                      {row.declaredType === 'separated' ? 'separated' : 'mixed'}
                    </div>
                  )}
                </div>
                <DpStatusPill status={processed ? 'processed' : 'pending'} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
