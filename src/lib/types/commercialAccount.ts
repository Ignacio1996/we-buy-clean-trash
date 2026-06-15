import type { Timestamp } from 'firebase-admin/firestore';
import type { BinSize } from '@/lib/logic/binWeightTable';
import type { MaterialId } from './material';

/**
 * Commercial site directory record — admin-onboarded, mirrors the Compost
 * Clubhouse "Directory" sheet. Sites can exist without a UserDoc (no portal
 * access). Bins (BagDocs with containerType: 'bin_*') reference these via
 * commercialAccountId. Pickups + bin-pickup records also link here.
 */
export interface CommercialAccountDoc {
  id: string;
  /** Business name shown in the operator UI and reports. */
  businessName: string;
  /** Free-form contact name (the person the driver talks to on-site). */
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  street: string;
  unit: string | null;
  city: string;
  state: string;
  postalCode: string;
  geo: { lat: number; lng: number } | null;
  zoneId: string;
  /**
   * Default bin size offered to this site. The site can have multiple bins of
   * mixed sizes (each with its own QR), but this is the size used when
   * provisioning new bins from the admin form.
   */
  defaultBinSize: BinSize;
  /**
   * Declared number of bins physically at the site — mirrors the Directory
   * sheet's "# of Bins" column and drives the report's "Bins on Site" value.
   * This is editable site metadata, distinct from the count of provisioned QR
   * bag docs (which may be zero for historical/imported sites).
   */
  binsOnSite: number;
  /** Number of pickups per week — Tia's drivers sequence routes around this. */
  pickupsPerWeek: number;
  /**
   * Day(s) of the week pickup happens — stored as ISO weekday numbers
   * (1 = Monday … 7 = Sunday). Multiple values when service runs more than
   * once a week (e.g. [1, 4] for Mon + Thu).
   */
  collectionDays: number[];
  /**
   * Affiliation tag — drives report filtering (e.g. 'compost_clubhouse',
   * 'city_of_columbus'). Free-form string, not a separate collection.
   */
  affiliationId: string | null;
  /**
   * Materials picked up at this site. For Tia's flow this is just ['food_scrap'].
   * Stored explicitly so the operator UI knows what to show per stop.
   */
  materialIds: MaterialId[];
  /**
   * First month this site has collection data — mirrors the Directory sheet's
   * "First Month of Data" column. Drives the "Months Active" all-time KPI in
   * the monthly reports (DATEDIF from this month to the report month). Stored
   * as a Timestamp pinned to the first of the month; null for sites onboarded
   * before any pickup has been recorded.
   */
  firstMonthOfData: Timestamp | null;
  /** Soft-delete flag — historical pickups stay attached. */
  active: boolean;
  /** Public-facing notes the driver sees on-site (gate code, bin location, etc.). */
  driverNotes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const COLLECTION_DAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export function isCollectionDay(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7;
}

/**
 * Resolves a list of pickup days from raw input. Returns sorted, deduped,
 * 1..7. Returns null when input is invalid.
 */
export function normalizeCollectionDays(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const out = new Set<number>();
  for (const v of raw) {
    if (!isCollectionDay(v)) return null;
    out.add(v);
  }
  if (out.size === 0) return null;
  return [...out].sort((a, b) => a - b);
}
