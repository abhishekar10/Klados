/**
 * Rotation-cycle math for recurring nodes (brief §4) — pure, no DB/React, so it's cheap to
 * unit-test directly (lib/__tests__/cycles.test.ts) the way lib/rollup.ts's algorithm is.
 */

/** Whole days between an ISO "YYYY-MM-DD" start date and `today`, floored at 0. */
export function daysSince(startDate: string, today: Date): number {
  const start = new Date(`${startDate}T00:00:00`);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffMs = todayMidnight.getTime() - startMidnight.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Today's due child id, per brief §4: `cycle_pattern[(today - cycle_started_at) % length]` — a
 * rolling, day-count-based cycle (not pinned to calendar weekdays).
 */
export function getDueChildId(cyclePattern: string[], cycleStartedAt: string, today: Date): string | null {
  if (cyclePattern.length === 0) return null;
  const dayIndex = daysSince(cycleStartedAt, today) % cyclePattern.length;
  return cyclePattern[dayIndex];
}

/** "YYYY-MM-DD" for a given Date, in local time (not UTC — a day boundary is a local concept here). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
