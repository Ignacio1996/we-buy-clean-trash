import type { Timestamp } from 'firebase-admin/firestore';
import type { BinSize } from '@/lib/logic/binWeightTable';
import type { MaterialId } from './material';

export const COMMERCIAL_ACCOUNT_STATUSES = ['active', 'paused'] as const;
export type CommercialAccountStatus = (typeof COMMERCIAL_ACCOUNT_STATUSES)[number];

export function isCommercialAccountStatus(v: unknown): v is CommercialAccountStatus {
  return (
    typeof v === 'string' && (COMMERCIAL_ACCOUNT_STATUSES as readonly string[]).includes(v)
  );
}

/**
 * What kind of stop the driver does here.
 * - `compost`: food-scrap bin pickup — the default flow (fullness + weight).
 * - `recycling_check`: a recycling/trash cart check (e.g. Dora Lofts) — the
 *   driver inspects carts, takes a photo, and flags contamination/overflow.
 *   No weight or bin fullness. Legacy docs without this field are `compost`.
 * - `recycling_weighed`: WBCT reusable-tote recycling (e.g. Dora's Loft) — the
 *   driver scans the permanent bin QR, collects raw recyclables, and records a
 *   measured net weight (gross tote − tare). Diversion-only, no points. This is
 *   the pilot model for the reusable-container WBCT flow.
 */
export const SITE_TYPES = ['compost', 'recycling_check', 'recycling_weighed'] as const;
export type SiteType = (typeof SITE_TYPES)[number];

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  compost: 'Compost (food-scrap bins)',
  recycling_check: 'Recycling check (cart inspection)',
  recycling_weighed: 'Recycling — weighed (reusable tote)',
};

export function isSiteType(v: unknown): v is SiteType {
  return typeof v === 'string' && (SITE_TYPES as readonly string[]).includes(v);
}

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
   * What the driver does at this stop. Defaults to `compost` (food-scrap bin
   * pickup); `recycling_check` sites use the cart-inspection flow instead.
   * Legacy docs without this field are treated as `compost`.
   */
  siteType: SiteType;
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
  /**
   * Number of bins currently usable/operative at the site — always <= binsOnSite.
   * Lets the admin record a temporary capacity drop (e.g. bins damaged, or a
   * reduced staging area that only fits two) without losing the declared total,
   * so "mark full" and the operator's bin rows reflect real capacity. `null`
   * means all binsOnSite are operative — the normal case and the legacy default.
   */
  operativeBins: number | null;
  /** Number of pickups per week — Tia's drivers sequence routes around this. */
  pickupsPerWeek: number;
  /**
   * Day(s) of the week pickup happens — stored as ISO weekday numbers
   * (1 = Monday … 7 = Sunday). Multiple values when service runs more than
   * once a week (e.g. [1, 4] for Mon + Thu).
   */
  collectionDays: number[];
  /**
   * Sequence position within the day's route — lower numbers are visited first.
   * Lets the operator's site list match the order Tia drives (the emailed route
   * sheet). Null for sites not yet sequenced; those sort after ordered sites,
   * alphabetically. Not unique-enforced — ties fall back to name order.
   */
  routeOrder: number | null;
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
  /**
   * Service status, distinct from archive (`active`). `paused` is a planned,
   * temporary pause — e.g. a school over summer break — so the gap doesn't read
   * as a missed pickup and the site is dropped from the operator's daily list.
   * Legacy docs without this field are treated as 'active'.
   */
  status: CommercialAccountStatus;
  /** Public-facing notes the driver sees on-site (gate code, bin location, etc.). */
  driverNotes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Effective count of usable bins at a site — `operativeBins` when explicitly set
 * (and clamped to the declared total), otherwise the full `binsOnSite`. Callers
 * should use this instead of reading the raw fields so legacy docs (no
 * `operativeBins`) and the "all operative" case both resolve correctly.
 */
export function resolveOperativeBins(account: {
  binsOnSite: number;
  operativeBins?: number | null;
}): number {
  const declared = Math.max(0, Math.floor(account.binsOnSite ?? 0));
  const op = account.operativeBins;
  if (typeof op !== 'number' || !Number.isFinite(op)) return declared;
  return Math.max(0, Math.min(declared, Math.floor(op)));
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
