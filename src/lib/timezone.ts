/**
 * Timezone helper for current-or-historical date validation and Daily Agenda locking.
 *
 * All school-local date comparisons use this helper instead of raw `new Date()`
 * so a server in UTC cannot compute a different "today" than the school's
 * Asia/Karachi calendar.
 *
 * The school's timezone is Asia/Karachi (PKT, UTC+5). This is hardcoded
 * rather than configurable because:
 * 1. This is a single-school-per-deployment system
 * 2. All existing date-handling code already uses server-local time with
 *    similar implicit assumptions — this makes the behavior explicit
 * 3. The Pakistani school system context means PKT is always correct here
 *
 * See SRS §2.5 for the rationale.
 */

const PKT_OFFSET_HOURS = 5;

/**
 * Get today's date string in YYYY-MM-DD format using Asia/Karachi (PKT) timezone.
 * This is the single source of truth for "what is today?" across historical date features.
 */
export function getTodayLocal(): string {
  const now = new Date();
  // Convert to PKT by adding the offset
  const pktTime = new Date(now.getTime() + PKT_OFFSET_HOURS * 60 * 60 * 1000);
  const year = pktTime.getUTCFullYear();
  const month = String(pktTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(pktTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Return true only for a real calendar date in YYYY-MM-DD form. */
export function isValidDateOnly(dateStr: string): boolean {
  if (!DATE_ONLY_PATTERN.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateStr;
}

/** Check whether a valid date-only string is later than PKT today. */
export function isDateInFuture(dateStr: string): boolean {
  return isValidDateOnly(dateStr) && dateStr > getTodayLocal();
}

/** Check if a date string is locked because it is before PKT today. */
export function isDateLocked(dateStr: string): boolean {
  return isValidDateOnly(dateStr) && dateStr < getTodayLocal();
}
