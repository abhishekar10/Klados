import { getTodayStatus, listAllGoals, type Goal } from './goals';
import { surfaceTodaysTasks, type SurfacingCandidate, type SurfacingReason } from './surfacing';

export interface SurfacedGoal {
  goal: Goal;
  reason: SurfacingReason;
}

/**
 * Assembles brief §6's Home-screen "today's tasks" list: flattens the whole tree into
 * candidates (leaf-ness derived from parent-id references, per brief §1), asks each recurring
 * node whether today's instance is already logged, then hands off to the pure ordering/filtering
 * in lib/surfacing.ts.
 */
export async function getTodaysSurfacedGoals(options: { cap?: number; dueSoonHours?: number } = {}): Promise<SurfacedGoal[]> {
  const allGoals = await listAllGoals();

  const parentIds = new Set(allGoals.filter((g) => g.parentId !== null).map((g) => g.parentId as string));

  const candidates: SurfacingCandidate[] = await Promise.all(
    allGoals.map(async (goal): Promise<SurfacingCandidate> => {
      const recurringDoneToday =
        goal.scheduleType === 'recurring' ? (await getTodayStatus(goal.id)).completedToday : false;
      return {
        id: goal.id,
        lifecycleState: goal.lifecycleState,
        scheduleType: goal.scheduleType,
        timeOfDay: goal.timeOfDay,
        isComplete: goal.isComplete,
        isLeaf: !parentIds.has(goal.id),
        recurringDoneToday,
        updatedAt: goal.updatedAt,
      };
    }),
  );

  const surfaced = surfaceTodaysTasks(candidates, new Date(), options);
  const goalById = new Map(allGoals.map((g) => [g.id, g]));

  return surfaced.map((s) => ({ goal: goalById.get(s.id) as Goal, reason: s.reason }));
}
