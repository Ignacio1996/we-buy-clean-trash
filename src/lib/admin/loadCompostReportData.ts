import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { Timestamp } from 'firebase-admin/firestore';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import type { BinPickupDoc } from '@/lib/types/binPickup';
import type { ReportPickupInput, ReportSiteInput } from '@/lib/logic/compostReport';

/** "YYYY-MM" for a Firestore Timestamp, in UTC (matches how firstMonthOfData is stored). */
function monthKeyOf(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface CompostReportData {
  sites: ReportSiteInput[];
  pickups: ReportPickupInput[];
  /** Distinct affiliation tags present across sites (for the filter), sorted. */
  affiliations: string[];
  /** Distinct pickup months present, sorted ascending ("YYYY-MM"). */
  months: string[];
}

/**
 * Loads everything the compost report engine needs: the full commercial-site
 * directory + every bin pickup (cumulative figures require the full history).
 * Pilot scale is small enough to read both collections whole. Maps Firestore
 * docs into the plain inputs `buildCompostMonthlyReport` expects.
 */
export async function loadCompostReportData(): Promise<CompostReportData> {
  const [accountsSnap, pickupsSnap, binsSnap] = await Promise.all([
    adminDb.collection('commercialAccounts').get(),
    adminDb.collection('binPickups').get(),
    adminDb.collection('bags').where('reusable', '==', true).get(),
  ]);

  // Bins currently provisioned per site → "Bins on Site" reference column.
  const binsOnSite = new Map<string, number>();
  binsSnap.docs.forEach((d) => {
    const accId = d.get('commercialAccountId');
    if (typeof accId === 'string') {
      binsOnSite.set(accId, (binsOnSite.get(accId) ?? 0) + 1);
    }
  });

  const sites: ReportSiteInput[] = accountsSnap.docs.map((d) => {
    const a = d.data() as CommercialAccountDoc;
    const firstMonth = a.firstMonthOfData ?? null;
    // Prefer the declared bin count (Directory metadata / imported sites);
    // fall back to provisioned QR bag docs for sites onboarded before the field.
    const declared = typeof a.binsOnSite === 'number' ? a.binsOnSite : null;
    return {
      siteId: a.id,
      businessName: a.businessName,
      affiliationId: a.affiliationId ?? null,
      binsOnSite: declared ?? binsOnSite.get(a.id) ?? 0,
      active: a.active !== false,
      firstMonthKey: firstMonth ? monthKeyOf(firstMonth) : null,
    };
  });

  const monthSet = new Set<string>();
  const pickups: ReportPickupInput[] = pickupsSnap.docs.map((d) => {
    const p = d.data() as BinPickupDoc;
    const monthKey = monthKeyOf(p.createdAt);
    monthSet.add(monthKey);
    const bins = Array.isArray(p.bins) ? p.bins : [];
    return {
      siteId: p.commercialAccountId,
      monthKey,
      totalWeightLbs: p.totalWeightLbs ?? 0,
      binFullness: bins.map((b) => b.fullness),
      binCount: bins.length,
    };
  });

  const affiliations = [
    ...new Set(sites.map((s) => s.affiliationId).filter((x): x is string => !!x)),
  ].sort();

  return {
    sites,
    pickups,
    affiliations,
    months: [...monthSet].sort(),
  };
}
