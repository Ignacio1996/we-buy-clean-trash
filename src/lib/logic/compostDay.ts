/**
 * A "driver day" identifies one operator's compost work on one Columbus calendar
 * day. The operator flow no longer has Start Route / End Route sessions — drivers
 * just record per-site pickups — so the admin "Route runs" view derives each run
 * from the day's `binPickups` + `siteChecks` grouped by operator + local day,
 * rather than from a stored `compostRoutes` doc.
 *
 * The synthetic id is `${operatorId}__${dayKey}`. Firebase uids are alphanumeric
 * (no underscores) and `dayKey` is `YYYY-MM-DD`, so the `__` separator is
 * unambiguous. Pure (date math only) per the repo's logic conventions.
 */
import { columbusDayStart } from './columbusDate';

const SEP = '__';

export function dayRunId(operatorId: string, dayKey: string): string {
  return `${operatorId}${SEP}${dayKey}`;
}

export function parseDayRunId(id: string): { operatorId: string; dayKey: string } | null {
  const i = id.lastIndexOf(SEP);
  if (i <= 0) return null;
  const operatorId = id.slice(0, i);
  const dayKey = id.slice(i + SEP.length);
  if (!operatorId || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  return { operatorId, dayKey };
}

/**
 * The UTC instant range [start, end) covering a Columbus calendar day. Anchored
 * at noon UTC (which is the same calendar day in Columbus year-round) so it's
 * DST-safe — both bounds are real Columbus midnights.
 */
export function columbusDayBounds(dayKey: string): { start: Date; end: Date } {
  const noon = new Date(`${dayKey}T12:00:00Z`);
  const start = columbusDayStart(noon);
  const end = columbusDayStart(new Date(noon.getTime() + 24 * 60 * 60 * 1000));
  return { start, end };
}
