import { randomUUID } from 'expo-crypto';
import { and, desc, eq, isNull, like, ne, or } from 'drizzle-orm';

import { db } from '../db/client';
import { goals, type LifecycleState, type RecurringMode } from '../db/schema';
import {
  getChecklistStatusForDate,
  getChecklistTrailingRate,
  getCompletionForDate,
  getLastCompletionAt,
  getTrailingCompletionRate,
  logChecklistCompletion,
  logCompletion,
} from './completionLog';
import { getDueChildId, toDateKey } from './cycles';
import { computeProgress } from './rollup';
import { getSettings } from './settings';

export type Goal = typeof goals.$inferSelect;

/**
 * Data-access layer for the goal tree. Covers all three schedule types (brief §4) — one-shot,
 * recurring (rotation cycles + completion_log), and date-range.
 *
 * No cached progress column: PROJECT-BRIEF.md §5's data model doesn't list one (only §2's
 * prose mentions caching, as a future optimization). For MVP-scale trees, recomputing a
 * subtree's progress on demand (see computeSubtreeProgress below) is simpler and has no
 * invalidation bugs to get wrong — worth revisiting only if a real tree gets large enough for
 * it to matter.
 */

/**
 * Archived goals are excluded by default (brief §8.3: "Archived nodes are hidden by default,
 * reachable via a 'Show archived' toggle in Settings") — pass includeArchived: true (driven by
 * store/settings.ts's showArchived flag) to include them.
 */
export async function listChildren(
  parentId: string | null,
  options: { includeArchived?: boolean } = {},
): Promise<Goal[]> {
  const parentClause = parentId === null ? isNull(goals.parentId) : eq(goals.parentId, parentId);
  const where = options.includeArchived ? parentClause : and(parentClause, ne(goals.lifecycleState, 'archived'));
  return db.select().from(goals).where(where).orderBy(goals.sortOrder);
}

export async function getGoal(id: string): Promise<Goal | undefined> {
  const rows = await db.select().from(goals).where(eq(goals.id, id));
  return rows[0];
}

/** Every goal, unfiltered — the Home-surfacing algorithm (lib/home.ts) needs a flat whole-tree view. */
export async function listAllGoals(): Promise<Goal[]> {
  return db.select().from(goals);
}

export async function createGoal(input: {
  parentId: string | null;
  title: string;
  description?: string | null;
  sortOrder?: number;
}): Promise<Goal> {
  const now = new Date();
  const [row] = await db
    .insert(goals)
    .values({
      id: randomUUID(),
      parentId: input.parentId,
      title: input.title,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
      lifecycleState: 'active',
      stateChangedAt: now,
      scheduleType: 'one-shot',
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function updateGoal(
  id: string,
  updates: Partial<Pick<Goal, 'title' | 'description' | 'sortOrder'>>,
): Promise<void> {
  await db
    .update(goals)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(goals.id, id));
}

/** Children cascade automatically via the schema's onDelete: 'cascade' foreign key. */
export async function deleteGoal(id: string): Promise<void> {
  await db.delete(goals).where(eq(goals.id, id));
}

/**
 * Toggles a leaf's completion (any non-recurring schedule type — one-shot or date-range; brief
 * §8.3's complete toggle is leaves-only regardless of type). Also drives lifecycle_state: brief
 * §3's diagram shows Active --complete--> Complete for one-shot/date-range nodes, so completing
 * the leaf is what *means* "this node is Complete." Reversing the toggle returns it to Active.
 *
 * Parent nodes of any schedule type never reach Complete manually — consistent with this
 * project's standing decision (see ExplorerScreen's lifecycle-action gating) that a parent's
 * lifecycle_state never auto- or manually transitions off of Active except to Paused/Archived;
 * only its rolled-up progress reflects how "done" it is. Revisit this together for one-shot and
 * date-range parents alike if that decision ever changes — don't special-case just one type.
 */
export async function toggleLeafComplete(id: string, isComplete: boolean): Promise<void> {
  const now = new Date();
  await db
    .update(goals)
    .set({
      isComplete,
      lifecycleState: isComplete ? 'complete' : 'active',
      stateChangedAt: now,
      updatedAt: now,
    })
    .where(eq(goals.id, id));
}

export async function setLifecycleState(id: string, state: LifecycleState): Promise<void> {
  const now = new Date();
  await db
    .update(goals)
    .set({ lifecycleState: state, stateChangedAt: now, updatedAt: now })
    .where(eq(goals.id, id));
}

/**
 * Reparents a node, guarding against creating a cycle: a node can never move under itself or
 * one of its own descendants (the brief doesn't specify this, but allowing it would corrupt
 * the tree and infinite-loop any recursive walk, including computeProgress).
 */
export async function moveGoal(id: string, newParentId: string | null): Promise<void> {
  if (newParentId !== null) {
    if (newParentId === id) {
      throw new Error('A node cannot be moved under itself.');
    }
    let cursor: string | null = newParentId;
    while (cursor !== null) {
      if (cursor === id) {
        throw new Error('Cannot move a node under one of its own descendants.');
      }
      const parent: Goal | undefined = await getGoal(cursor);
      cursor = parent?.parentId ?? null;
    }
  }
  await db
    .update(goals)
    .set({ parentId: newParentId, updatedAt: new Date() })
    .where(eq(goals.id, id));
}

/**
 * Reorders a node one position among its siblings (brief §10 Phase 2's "drag-and-drop reorder").
 * Implemented as a swap-with-neighbor rather than true drag gestures — no drag-gesture library
 * is in the dependency set, and a swap achieves the same end state (arbitrary reordering via
 * repeated calls) without adding one. A no-op at either end of the sibling list.
 *
 * `includeArchived` must match whatever list the caller's canMoveUp/canMoveDown (and the ▲/▼
 * buttons) were computed against — otherwise, with an archived sibling hidden between two
 * visible ones, this would swap with the hidden neighbor instead of the visible one the user is
 * looking at: the button would appear to do nothing while silently writing to the DB.
 */
export async function reorderSibling(
  id: string,
  direction: 'up' | 'down',
  options: { includeArchived?: boolean } = {},
): Promise<void> {
  const goal = await getGoal(id);
  if (!goal) return;
  const siblings = await listChildren(goal.parentId, options);
  const index = siblings.findIndex((s) => s.id === id);
  const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return;
  const now = new Date();
  await db.update(goals).set({ sortOrder: swapWith.sortOrder, updatedAt: now }).where(eq(goals.id, goal.id));
  await db.update(goals).set({ sortOrder: goal.sortOrder, updatedAt: now }).where(eq(goals.id, swapWith.id));
}

/** Title/description substring search across the whole tree (brief §10 Phase 2), archived excluded. */
export async function searchGoals(query: string): Promise<Goal[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const pattern = `%${trimmed}%`;
  return db
    .select()
    .from(goals)
    .where(
      and(ne(goals.lifecycleState, 'archived'), or(like(goals.title, pattern), like(goals.description, pattern))),
    )
    .orderBy(desc(goals.updatedAt));
}

interface SubtreeStats {
  progress: number;
  /** Most recent completion event anywhere in the subtree — drives staleness (brief §7). */
  lastActivityAt: Date;
  /** Recurring nodes only — whether *today's* due instance is already logged. */
  recurringCompletedToday?: boolean;
}

/**
 * Progress (and the "last activity" staleness signal) always exclude archived descendants,
 * independent of whatever the "show archived" display preference is set to (getTree below uses
 * this for the `progress`/`lastActivityAt` fields but a *separately* archived-aware fetch for
 * `children`). A display toggle changing what a percentage or a staleness badge means would be
 * surprising and isn't implied by brief §2's rollup formula, so this always walks with
 * includeArchived: false regardless of what the caller is showing on screen.
 *
 * Recurring nodes (brief §2's amendment) report their trailing-window completion rate as their
 * own progress instead of averaging children — and their own children (if any, e.g. a rotation
 * cycle's Gym/Swimming) don't get individually rolled up into a parent average at all; the whole
 * recurring subtree acts as one unit from its parent's perspective.
 */
async function computeSubtreeStats(goalId: string): Promise<SubtreeStats> {
  const goal = await getGoal(goalId);
  if (!goal) return { progress: 0, lastActivityAt: new Date(0) };

  if (goal.scheduleType === 'recurring') {
    const settings = await getSettings();
    const mode = goal.recurringMode ?? 'rotation';
    const [lastCompletionAt, todayStatus] = await Promise.all([getLastCompletionAt(goalId), getTodayStatus(goalId)]);
    const progress =
      mode === 'checklist'
        ? await getChecklistTrailingRate(goalId, (goal.cyclePattern ?? []).length, settings.recurringWindowDays, new Date())
        : await getTrailingCompletionRate(goalId, settings.recurringWindowDays, new Date());
    return {
      progress,
      lastActivityAt: lastCompletionAt ?? goal.updatedAt,
      recurringCompletedToday: todayStatus.completedToday,
    };
  }

  const kids = await listChildren(goalId, { includeArchived: false });
  if (kids.length === 0) {
    return { progress: goal.isComplete ? 100 : 0, lastActivityAt: goal.updatedAt };
  }

  const childStats = await Promise.all(kids.map((kid) => computeSubtreeStats(kid.id)));
  const progress = computeProgress({
    id: goalId,
    isComplete: goal.isComplete,
    children: childStats.map((stats, i) => ({
      id: kids[i].id,
      isComplete: kids[i].isComplete,
      children: [],
      recurringProgressOverride: stats.progress,
    })),
  });
  const lastActivityAt = childStats.reduce(
    (max, stats) => (stats.lastActivityAt > max ? stats.lastActivityAt : max),
    goal.updatedAt,
  );
  return { progress, lastActivityAt };
}

export async function computeSubtreeProgress(goalId: string): Promise<number> {
  return (await computeSubtreeStats(goalId)).progress;
}

export interface GoalTreeNode {
  goal: Goal;
  children: GoalTreeNode[];
  progress: number;
  lastActivityAt: Date;
  /** Recurring nodes only — lets a row render today's state without a separate query per row. */
  recurringCompletedToday?: boolean;
}

/**
 * Fetches a level's children with their full subtrees (respecting `includeArchived` for what's
 * *displayed*) and each one's progress/staleness stats (always computed archived-excluded, per
 * computeSubtreeStats above — display and stats are deliberately independent).
 */
export async function getTree(
  parentId: string | null,
  options: { includeArchived?: boolean } = {},
): Promise<GoalTreeNode[]> {
  const kids = await listChildren(parentId, options);
  return Promise.all(
    kids.map(async (goal): Promise<GoalTreeNode> => {
      const [children, stats] = await Promise.all([getTree(goal.id, options), computeSubtreeStats(goal.id)]);
      return {
        goal,
        children,
        progress: stats.progress,
        lastActivityAt: stats.lastActivityAt,
        recurringCompletedToday: stats.recurringCompletedToday,
      };
    }),
  );
}

/**
 * Recurring-node schedule editing (brief §4/§8.3): the member-id pattern + activation date,
 * plus which of the two recurring shapes it is — rotation (one due member per day) or checklist
 * (every member due every day). Callers always pass the mode explicitly (usually the goal's
 * current one) so editing the pattern/date never silently resets it back to the default.
 */
export async function setRecurringSchedule(
  id: string,
  input: { cyclePattern: string[]; cycleStartedAt: string; recurringMode: RecurringMode },
): Promise<void> {
  await db
    .update(goals)
    .set({
      scheduleType: 'recurring',
      cyclePattern: input.cyclePattern,
      cycleStartedAt: input.cycleStartedAt,
      recurringMode: input.recurringMode,
      updatedAt: new Date(),
    })
    .where(eq(goals.id, id));
}

/** Date-range window (brief §4) — a visualization/scheduling overlay only; doesn't touch progress. */
export async function setDateRange(id: string, input: { rangeStart: string; rangeEnd: string }): Promise<void> {
  await db
    .update(goals)
    .set({ scheduleType: 'date-range', rangeStart: input.rangeStart, rangeEnd: input.rangeEnd, updatedAt: new Date() })
    .where(eq(goals.id, id));
}

/** Reverts a node to plain one-shot, clearing recurring/date-range fields. */
export async function setOneShot(id: string): Promise<void> {
  await db
    .update(goals)
    .set({
      scheduleType: 'one-shot',
      cyclePattern: null,
      cycleStartedAt: null,
      rangeStart: null,
      rangeEnd: null,
      updatedAt: new Date(),
    })
    .where(eq(goals.id, id));
}

/** Time-of-day tag (brief §4) — orthogonal to schedule_type, editable any time. Pass null to clear. */
export async function setTimeOfDay(id: string, timeOfDay: string | null): Promise<void> {
  await db.update(goals).set({ timeOfDay, updatedAt: new Date() }).where(eq(goals.id, id));
}

export interface TodayStatus {
  mode: RecurringMode;
  /** Rotation mode only — today's due child, per brief §4. Null for checklist mode or an unconfigured cycle. */
  dueChildId: string | null;
  /** Rotation: whether today's single due instance is logged. Checklist: whether every member is checked today. */
  completedToday: boolean;
  /** Checklist mode only — each member's own today status. Empty for rotation mode. */
  checklistStatus: Record<string, boolean>;
}

/** Where a recurring node stands for "today" — used to render/act on its due instance(s). */
export async function getTodayStatus(goalId: string, today: Date = new Date()): Promise<TodayStatus> {
  const goal = await getGoal(goalId);
  if (!goal || goal.scheduleType !== 'recurring') {
    return { mode: 'rotation', dueChildId: null, completedToday: false, checklistStatus: {} };
  }
  const mode = goal.recurringMode ?? 'rotation';

  if (mode === 'checklist') {
    const members = goal.cyclePattern ?? [];
    const loggedStatus = await getChecklistStatusForDate(goalId, toDateKey(today));
    const checklistStatus: Record<string, boolean> = {};
    for (const memberId of members) checklistStatus[memberId] = loggedStatus.get(memberId) ?? false;
    const completedToday = members.length > 0 && members.every((memberId) => checklistStatus[memberId]);
    return { mode, dueChildId: null, completedToday, checklistStatus };
  }

  const dueChildId =
    goal.cyclePattern && goal.cyclePattern.length > 0 && goal.cycleStartedAt
      ? getDueChildId(goal.cyclePattern, goal.cycleStartedAt, today)
      : null;
  const log = await getCompletionForDate(goalId, toDateKey(today));
  return { mode, dueChildId, completedToday: log?.completed ?? false, checklistStatus: {} };
}

/** Logs (or un-logs) today's due instance for a rotation-mode recurring node — the completion_log write. */
export async function markRecurringCompleteToday(
  goalId: string,
  completed: boolean,
  today: Date = new Date(),
): Promise<void> {
  const { dueChildId } = await getTodayStatus(goalId, today);
  await logCompletion({ goalId, date: toDateKey(today), childId: dueChildId, completed });
}

/** Logs (or un-logs) one member's today instance for a checklist-mode recurring node. */
export async function markChecklistChildCompleteToday(
  goalId: string,
  childId: string,
  completed: boolean,
  today: Date = new Date(),
): Promise<void> {
  await logChecklistCompletion({ goalId, childId, date: toDateKey(today), completed });
}

/** Root-to-node path (inclusive of the node itself) — powers the drill-down breadcrumb (brief §8.3). */
export async function getAncestorChain(id: string): Promise<Goal[]> {
  const chain: Goal[] = [];
  let cursor: string | null = id;
  while (cursor !== null) {
    const node: Goal | undefined = await getGoal(cursor);
    if (!node) break;
    chain.unshift(node);
    cursor = node.parentId;
  }
  return chain;
}
