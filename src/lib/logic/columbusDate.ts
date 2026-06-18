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

/** Friendly date label like "Sun, Jun 15" in Columbus local time. */
export function columbusDateLabel(now: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: COLUMBUS_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(now);
}
