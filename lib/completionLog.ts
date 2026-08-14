import { randomUUID } from 'expo-crypto';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

import { db } from '../db/client';
import { completionLog } from '../db/schema';
import { toDateKey } from './cycles';

export type CompletionLogRow = typeof completionLog.$inferSelect;

/** One row per (goal, date) — today's due instance for a recurring node. Upserts by (goalId, date). */
export async function logCompletion(input: {
  goalId: string;
  date: string; // "YYYY-MM-DD"
  childId: string | null;
  completed: boolean;
}): Promise<void> {
  const existing = await db
    .select()
    .from(completionLog)
    .where(and(eq(completionLog.goalId, input.goalId), eq(completionLog.date, input.date)));

  const completedAt = input.completed ? new Date() : null;

  if (existing[0]) {
    await db
      .update(completionLog)
      .set({ childId: input.childId, completed: input.completed, completedAt })
      .where(eq(completionLog.id, existing[0].id));
  } else {
    await db.insert(completionLog).values({
      id: randomUUID(),
      goalId: input.goalId,
      date: input.date,
      childId: input.childId,
      completed: input.completed,
      completedAt,
    });
  }
}

export async function getCompletionForDate(goalId: string, date: string): Promise<CompletionLogRow | undefined> {
  const rows = await db
    .select()
    .from(completionLog)
    .where(and(eq(completionLog.goalId, goalId), eq(completionLog.date, date)));
  return rows[0];
}

/** Inclusive date range, for the streak calendar heatmap. */
export async function getCompletionLogRange(
  goalId: string,
  startDate: string,
  endDate: string,
): Promise<CompletionLogRow[]> {
  return db
    .select()
    .from(completionLog)
    .where(and(eq(completionLog.goalId, goalId), gte(completionLog.date, startDate), lte(completionLog.date, endDate)));
}

/**
 * % of due instances completed in the trailing window (brief §2's recurring-node amendment).
 * Counts *distinct completed dates*, not raw rows — rotation mode's own upsert-by-(goalId,date)
 * never produces more than one row per date, but a node that was ever in checklist mode (several
 * rows per date, one per member) could otherwise have that history counted multiple times over
 * if later switched back to rotation.
 */
export async function getTrailingCompletionRate(goalId: string, windowDays: number, today: Date): Promise<number> {
  const end = toDateKey(today);
  const start = new Date(today);
  start.setDate(start.getDate() - (windowDays - 1));
  const rows = await getCompletionLogRange(goalId, toDateKey(start), end);
  if (rows.length === 0) return 0;
  const completedCount = new Set(rows.filter((r) => r.completed).map((r) => r.date)).size;
  return (completedCount / windowDays) * 100;
}

/**
 * Checklist mode's per-child-per-day completion — unlike rotation's one-row-per-day model
 * (upserts by goalId+date only), a checklist day can have several children independently
 * checked, so this upserts by (goalId, date, childId).
 */
export async function logChecklistCompletion(input: {
  goalId: string;
  childId: string;
  date: string; // "YYYY-MM-DD"
  completed: boolean;
}): Promise<void> {
  const existing = await db
    .select()
    .from(completionLog)
    .where(
      and(
        eq(completionLog.goalId, input.goalId),
        eq(completionLog.date, input.date),
        eq(completionLog.childId, input.childId),
      ),
    );

  const completedAt = input.completed ? new Date() : null;

  if (existing[0]) {
    await db
      .update(completionLog)
      .set({ completed: input.completed, completedAt })
      .where(eq(completionLog.id, existing[0].id));
  } else {
    await db.insert(completionLog).values({
      id: randomUUID(),
      goalId: input.goalId,
      date: input.date,
      childId: input.childId,
      completed: input.completed,
      completedAt,
    });
  }
}

/** A checklist node's per-child completion state for one date. */
export async function getChecklistStatusForDate(goalId: string, date: string): Promise<Map<string, boolean>> {
  const rows = await db
    .select()
    .from(completionLog)
    .where(and(eq(completionLog.goalId, goalId), eq(completionLog.date, date)));
  return new Map(rows.filter((r) => r.childId !== null).map((r) => [r.childId as string, r.completed]));
}

/** date -> fraction of checklist children checked that day (0-1), for the streak calendar and rollup. */
export async function getChecklistDayFractions(
  goalId: string,
  totalChildren: number,
  startDate: string,
  endDate: string,
): Promise<Map<string, number>> {
  if (totalChildren === 0) return new Map();
  const rows = await getCompletionLogRange(goalId, startDate, endDate);
  const countByDate = new Map<string, number>();
  for (const row of rows) {
    if (row.completed && row.childId !== null) {
      countByDate.set(row.date, (countByDate.get(row.date) ?? 0) + 1);
    }
  }
  const fractions = new Map<string, number>();
  for (const [date, count] of countByDate) {
    fractions.set(date, count / totalChildren);
  }
  return fractions;
}

/**
 * Trailing-window average of the daily checked-fraction — checklist mode's counterpart to
 * getTrailingCompletionRate, for a checklist node's own rollup contribution. A day with no log
 * rows contributes 0, same as rotation's "days not counted in completedCount" behavior — both
 * divide by the full window, not just the days that were logged.
 */
export async function getChecklistTrailingRate(
  goalId: string,
  totalChildren: number,
  windowDays: number,
  today: Date,
): Promise<number> {
  const end = toDateKey(today);
  const start = new Date(today);
  start.setDate(start.getDate() - (windowDays - 1));
  const fractions = await getChecklistDayFractions(goalId, totalChildren, toDateKey(start), end);
  let sum = 0;
  for (const fraction of fractions.values()) sum += fraction;
  return (sum / windowDays) * 100;
}

/** Most recent logged completion for a recurring node — its staleness/"last activity" signal. */
export async function getLastCompletionAt(goalId: string): Promise<Date | null> {
  const rows = await db
    .select()
    .from(completionLog)
    .where(and(eq(completionLog.goalId, goalId), eq(completionLog.completed, true)))
    .orderBy(desc(completionLog.completedAt))
    .limit(1);
  return rows[0]?.completedAt ?? null;
}
