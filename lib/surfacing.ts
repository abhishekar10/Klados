import type { LifecycleState, ScheduleType } from '../db/schema';

/**
 * Home-screen daily-surfacing algorithm (brief §6) — pure, given a flat list of candidate
 * goals with the fields the algorithm needs (the caller is responsible for gathering these from
 * SQLite; this function only orders/filters them, so it's cheap to unit-test directly).
 */
export interface SurfacingCandidate {
  id: string;
  lifecycleState: LifecycleState;
  scheduleType: ScheduleType;
  timeOfDay: string | null; // "HH:MM"
  isComplete: boolean; // one-shot leaves only
  isLeaf: boolean;
  recurringDoneToday: boolean; // recurring nodes only
  updatedAt: Date;
}

export type SurfacingReason = 'overdue' | 'due-soon' | 'recurring-today' | 'fallback';

export interface SurfacedTask {
  id: string;
  reason: SurfacingReason;
}

function parseTimeToday(timeOfDay: string, now: Date): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  const d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function isDone(c: SurfacingCandidate): boolean {
  return c.scheduleType === 'recurring' ? c.recurringDoneToday : c.isComplete;
}

/**
 * Priority order (brief §6): overdue timed (soonest-passed-first) → due-soon timed (ascending)
 * → untimed recurring due today → fallback fill (untimed one-shot leaves, most-recently-touched
 * first), capped at ~5. Paused/Archived never appear. One-shot *parent* nodes are excluded
 * entirely — their `isComplete` is "derived/ignored" (brief §5), so a parent could never
 * actually clear an overdue flag once tagged with a time_of_day.
 */
export function surfaceTodaysTasks(
  candidates: SurfacingCandidate[],
  now: Date,
  options: { cap?: number; dueSoonHours?: number } = {},
): SurfacedTask[] {
  const cap = options.cap ?? 5;
  const dueSoonHours = options.dueSoonHours ?? 2;

  const eligible = candidates.filter(
    (c) => c.lifecycleState === 'active' && (c.scheduleType === 'recurring' || c.isLeaf),
  );

  const timed = eligible.filter((c) => c.timeOfDay !== null && !isDone(c));

  const overdue = timed
    .filter((c) => parseTimeToday(c.timeOfDay!, now).getTime() <= now.getTime())
    .sort((a, b) => parseTimeToday(b.timeOfDay!, now).getTime() - parseTimeToday(a.timeOfDay!, now).getTime());

  const dueSoonCutoff = now.getTime() + dueSoonHours * 60 * 60 * 1000;
  const dueSoon = timed
    .filter((c) => {
      const t = parseTimeToday(c.timeOfDay!, now).getTime();
      return t > now.getTime() && t <= dueSoonCutoff;
    })
    .sort((a, b) => parseTimeToday(a.timeOfDay!, now).getTime() - parseTimeToday(b.timeOfDay!, now).getTime());

  const untimedRecurringToday = eligible.filter(
    (c) => c.scheduleType === 'recurring' && c.timeOfDay === null && !c.recurringDoneToday,
  );

  const fallback = eligible
    .filter((c) => c.scheduleType === 'one-shot' && c.isLeaf && !c.isComplete && c.timeOfDay === null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const tag = (list: SurfacingCandidate[], reason: SurfacingReason): SurfacedTask[] =>
    list.map((c) => ({ id: c.id, reason }));

  return [
    ...tag(overdue, 'overdue'),
    ...tag(dueSoon, 'due-soon'),
    ...tag(untimedRecurringToday, 'recurring-today'),
    ...tag(fallback, 'fallback'),
  ].slice(0, cap);
}
