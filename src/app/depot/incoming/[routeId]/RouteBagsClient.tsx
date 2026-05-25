'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { QrScanner } from '@/components/scanner/QrScanner';
import { SS, SSPillButton } from '@/components/resident/ss/SS';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {scanMode ? (
        <QrScanner
          onDetected={handleDetected}
          scanInstructions="📷 Point at the bag QR"
          manualPlaceholder="Or type the printed number"
        />
      ) : (
        <SSPillButton
          variant="primary"
          onClick={() => {
            setError(null);
            setScanMode(true);
          }}
          leadingIcon={<IconScan size={20} color="#fff" stroke={2} />}
        >
          Scan a bag
        </SSPillButton>
      )}

      {error && (
        <div
          style={{
            background: SS.brand,
            color: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '12px 14px',
            boxShadow: `0 4px 0 ${SS.ink}`,
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: SS.inkSoft,
        }}
      >
        Bags on this route
      </div>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {rows.map((row) => {
          const processed = row.status === 'processed';
          const bg = processed ? SS.mint : '#fff';
          return (
            <li key={row.bagId}>
              <Link
                href={processed ? '#' : `/depot/process/${row.bagId}`}
                onClick={(e) => {
                  if (processed) e.preventDefault();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: bg,
                  border: `2px solid ${SS.ink}`,
                  borderRadius: 14,
                  padding: '12px 14px',
                  boxShadow: processed ? 'none' : `0 3px 0 ${SS.ink}`,
                  textDecoration: 'none',
                  color: SS.ink,
                  cursor: processed ? 'not-allowed' : 'pointer',
                  opacity: processed ? 0.85 : 1,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: 0.5,
                      color: SS.ink,
                    }}
                  >
                    #{row.printedNumber}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      letterSpacing: -0.2,
                      color: SS.ink,
                      marginTop: 2,
                    }}
                  >
                    {row.residentName}
                  </div>
                  {row.declaredType && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: SS.inkSoft,
                        marginTop: 2,
                      }}
                    >
                      Declared{' '}
                      {row.declaredType === 'separated' ? 'separated' : 'mixed'}
                    </div>
                  )}
                </div>
                {processed ? (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: SS.green,
                      color: '#fff',
                      border: `2px solid ${SS.ink}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>
                ) : (
                  <div
                    style={{
                      background: SS.yellow,
                      border: `2px solid ${SS.ink}`,
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: 1,
                      color: SS.ink,
                      flexShrink: 0,
                    }}
                  >
                    PENDING
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
