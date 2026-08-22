/**
 * Timezone helper for Daily Agenda date-based locking.
 *
 * All "is today?" comparisons in the Daily Agenda feature use this helper
 * instead of raw `new Date()` to avoid date-boundary bugs where a server
 * in UTC would compute a different "today" than the school's local time.
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
 * This is the single source of truth for "what is today?" in the agenda feature.
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

/**
 * Check if a date string (YYYY-MM-DD) is locked (in the past relative to PKT "today").
 * An entry is locked if its date is strictly before today.
 * Today and future dates are editable.
 */
export function isDateLocked(dateStr: string): boolean {
  return dateStr < getTodayLocal();
}
