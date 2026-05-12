'use client';

import { useEffect, useState } from 'react';
import styles from './landing.module.css';

const FIRST = ['M.', 'A.', 'J.', 'K.', 'S.', 'D.', 'R.', 'L.', 'T.', 'C.', 'B.', 'N.'];
const LAST = [
  'Reyes',
  'Okafor',
  'Chen',
  'Patel',
  'Park',
  'Vega',
  'Thompson',
  'Singh',
  'Khan',
  'Brooks',
  'Liu',
  'Garcia',
  'Adler',
  'Nakamura',
  'Diaz',
];
const CITY = ['Oakland', 'Berkeley', 'Emeryville', 'Alameda', 'San Leandro', 'Piedmont', 'Albany'];
const KIND = [
  'Aluminum & PET',
  'Cardboard run',
  'Mixed paper',
  'Glass · clear',
  'HDPE jugs',
  'Aluminum cans',
  'PET bottles',
  'Steel cans',
];

type Row = { when: string; who: string; city: string; what: string; pts: number };

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function points(): number {
  return Math.round((Math.random() * 6800 + 1200) / 10) * 10;
}

function ago(secondsAgo: number): string {
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  return `${Math.floor(secondsAgo / 3600)}h ago`;
}

function makeRow(secondsAgo: number): Row {
  return {
    when: ago(secondsAgo),
    who: `${rand(FIRST)} ${rand(LAST)}`,
    city: rand(CITY),
    what: rand(KIND),
    pts: points(),
  };
}

function initialRows(): Row[] {
  const rows: Row[] = [];
  let cursor = 4;
  for (let i = 0; i < 8; i++) {
    rows.push(makeRow(cursor));
    cursor += Math.floor(Math.random() * 40) + 10;
  }
  return rows;
}

export function LiveTicker() {
  const [rows, setRows] = useState<Row[]>(initialRows);

  useEffect(() => {
    const id = setInterval(() => {
      setRows((prev) => {
        const next = [makeRow(Math.floor(Math.random() * 8) + 2), ...prev.slice(0, -1)];
        for (let i = 1; i < next.length; i++) {
          const r = next[i];
          if (r.when.endsWith('s ago')) {
            const s = parseInt(r.when, 10) + 12;
            r.when = s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
          } else if (r.when.endsWith('m ago')) {
            const m = parseInt(r.when, 10);
            r.when = m < 59 ? `${m + (Math.random() < 0.4 ? 1 : 0)}m ago` : `1h ago`;
          }
        }
        return next;
      });
    }, 12000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.tickerList}>
      {rows.map((r, i) => (
        <div key={i} className={styles.tickerItem}>
          <div className={styles.tickerWhen}>{r.when}</div>
          <div className={styles.tickerWho}>
            {r.who}
            <span className={styles.tickerCity}>{r.city}</span>
          </div>
          <div className={styles.tickerWhat}>{r.what}</div>
          <div className={styles.tickerPts}>+{r.pts.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
