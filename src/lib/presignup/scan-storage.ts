import type { ScannedItem } from '@/lib/ai/scan';

export const PRESIGNUP_SCAN_KEY = 'wbct.presignupScan';

export interface PresignupScan {
  items: ScannedItem[];
  totalDollars: number;
  totalPoints: number;
}

export function readPresignupScan(): PresignupScan | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PRESIGNUP_SCAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PresignupScan;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Cached snapshot for useSyncExternalStore — reads the raw string and only
// re-parses when it changes, so the returned object reference is stable
// across re-renders (avoids infinite update loops).
let cachedRaw: string | null = null;
let cachedScan: PresignupScan | null = null;

export function getPresignupScanSnapshot(): PresignupScan | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PRESIGNUP_SCAN_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedScan;
  cachedRaw = raw;
  if (!raw) {
    cachedScan = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PresignupScan;
    cachedScan =
      Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed : null;
  } catch {
    cachedScan = null;
  }
  return cachedScan;
}

export function writePresignupScan(scan: PresignupScan): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRESIGNUP_SCAN_KEY, JSON.stringify(scan));
  } catch {
    // quota / private mode — ignore
  }
}

export function clearPresignupScan(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PRESIGNUP_SCAN_KEY);
  } catch {
    // ignore
  }
}
