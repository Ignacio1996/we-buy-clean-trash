/**
 * Local calendar date + time helpers for Columbus (America/New_York).
 *
 * Compost runs are bucketed by Tia's local day, not UTC — a Sunday-evening run
 * must not roll into Monday. Pure (pass the clock in) so it stays unit-testable
 * and framework-free per the repo's logic conventions.
 */
const COLUMBUS_TZ = 'America/New_York';

/** "YYYY-MM-DD" for the given instant in Columbus local time (en-CA → ISO order). */
export function columbusDateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COLUMBUS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Short clock label like "2:04 PM" in Columbus local time. */
export function columbusTimeLabel(now: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: COLUMBUS_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);
}

/** Milliseconds Columbus local time is offset from UTC at the given instant (EDT = -4h, EST = -5h). */
function columbusOffsetMs(now: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: COLUMBUS_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - now.getTime();
}

/** UTC instant of midnight (start of day) in Columbus local time for the given instant. */
export function columbusDayStart(now: Date): Date {
  const [y, m, d] = columbusDateKey(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - columbusOffsetMs(now));
}

/**
 * ISO weekday (1 = Mon … 7 = Sun) for a "YYYY-MM-DD" calendar date key. Parsed
 * at noon UTC so the weekday is the same calendar day everywhere — matches the
 * 1..7 convention used by CommercialAccountDoc.collectionDays.
 */
export function weekdayFromDateKey(dayKey: string): number {
  const dow = new Date(`${dayKey}T12:00:00Z`).getUTCDay(); // 0 = Sun
  return dow === 0 ? 7 : dow;
}

/**
 * "YYYY-MM-DD" of the Monday that starts the week containing `now` (Columbus
 * local). Week starts Monday to match collectionDays (1 = Mon … 7 = Sun).
 */
export function columbusWeekStartKey(now: Date): string {
  const todayKey = columbusDateKey(now);
  const weekday = weekdayFromDateKey(todayKey); // 1 = Mon … 7 = Sun
  const [y, m, d] = todayKey.split('-').map(Number);
  // Noon UTC keeps the calendar day stable across time zones; Date.UTC handles
  // negative day rollover into the previous month.
  return columbusDateKey(new Date(Date.UTC(y, m - 1, d - (weekday - 1), 12)));
}

/** UTC instant of Monday 00:00 Columbus local for the week containing `now`. */
export function columbusWeekStart(now: Date): Date {
  const [y, m, d] = columbusWeekStartKey(now).split('-').map(Number);
  return columbusDayStart(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Friendly date label like "Sun, Jun 15" in Columbus local time. */
export function columbusDateLabel(now: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: COLUMBUS_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(now);
}
