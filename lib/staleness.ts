/**
 * Staleness detection (brief §7) — pure threshold comparison, kept separate from the DB query
 * that produces `lastActivityAt` (lib/goals.ts's computeSubtreeStats) so the actual date math
 * is unit-testable without a database.
 */
export function isStale(lastActivityAt: Date, thresholdDays: number, now: Date): boolean {
  const diffDays = (now.getTime() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > thresholdDays;
}
