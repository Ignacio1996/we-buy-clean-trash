import type { Timestamp } from 'firebase-admin/firestore';

export interface ZoneDoc {
  id: string;
  name: string;
  depotId: string;
  // Days of the week (0=Sun..6=Sat) when pickups occur in this zone.
  // Sorted ascending. Older docs may have stored a single `pickupDayOfWeek: number`;
  // use `resolvePickupDays` when reading.
  pickupDaysOfWeek: number[];
  zipCodes: string[];
  createdAt: Timestamp;
}

// Reads either the new array field or the legacy single-day field and
// returns a normalized, sorted, deduped array of 0..6 day indexes.
export function resolvePickupDays(zone: {
  pickupDaysOfWeek?: unknown;
  pickupDayOfWeek?: unknown;
}): number[] {
  const raw = Array.isArray(zone.pickupDaysOfWeek)
    ? zone.pickupDaysOfWeek
    : typeof zone.pickupDayOfWeek === 'number'
      ? [zone.pickupDayOfWeek]
      : [];
  const days = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 6) days.add(n);
  }
  return [...days].sort((a, b) => a - b);
}

// Validates an incoming list of day-of-week numbers (0..6). Returns the
// normalized array, or null if the input is invalid or empty.
export function parsePickupDays(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const days = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 6) return null;
    days.add(n);
  }
  if (days.size === 0) return null;
  return [...days].sort((a, b) => a - b);
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
