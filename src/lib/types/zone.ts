import type { Timestamp } from 'firebase-admin/firestore';

export interface ZoneDoc {
  id: string;
  name: string;
  depotId: string;
  pickupDayOfWeek: number;
  zipCodes: string[];
  createdAt: Timestamp;
}

// Accepts messy paste: commas, newlines, spaces, with or without trailing +4.
// Normalizes to 5-digit strings and dedupes.
export function parseZipCodes(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[\s,;]+/)) {
    const head = raw.split('-')[0]?.trim() ?? '';
    if (/^\d{5}$/.test(head)) seen.add(head);
  }
  return [...seen];
}
