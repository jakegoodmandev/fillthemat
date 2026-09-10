/**
 * Pure math for the overview metrics. Kept separate from the SQL so the edge
 * cases (zero denominator, cancellation semantics) are unit-testable without a
 * database.
 */

/**
 * Booking conversion as one number: distinct eligible public-page sessions with
 * at least one booking, divided by eligible sessions, all time. Returns `null`
 * when the denominator is zero — the UI renders `—` in that case, never `0%`
 * and never a clamped `100%`.
 */
export function conversionRate(
  convertedSessions: number,
  eligibleSessions: number,
): number | null {
  if (eligibleSessions === 0) return null;
  return Math.round((convertedSessions / eligibleSessions) * 1000) / 10;
}

/** "12.5%" or "—" (when there are no eligible sessions yet). */
export function formatConversionRate(
  convertedSessions: number,
  eligibleSessions: number,
): string {
  const rate = conversionRate(convertedSessions, eligibleSessions);
  return rate == null ? "—" : `${rate}%`;
}

/**
 * Scope line for the conversion cell: evidence the number is trustworthy.
 * "10 of 80 eligible sessions" when the denominator exists, otherwise a plain
 * explanation.
 */
export function formatConversionScope(
  convertedSessions: number,
  eligibleSessions: number,
): string {
  if (eligibleSessions === 0) return "No eligible sessions yet";
  return `${convertedSessions} of ${eligibleSessions} eligible sessions`;
}
