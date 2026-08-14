import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

/**
 * Full schema per PROJECT-BRIEF.md §5, created upfront per §10 build-order step 1
 * ("set up expo-sqlite schema, including Phase 1.5 columns/table") — only the
 * features that read schedule_type, time_of_day, range_start/range_end,
 * cycle_pattern/cycle_started_at, and completion_log are deferred to Phase 1.5,
 * not the columns themselves.
 */

export const LIFECYCLE_STATES = ['active', 'paused', 'complete', 'archived'] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const SCHEDULE_TYPES = ['one-shot', 'recurring', 'date-range'] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

// A recurring node is either a rotation (one due child per day, cycling through cyclePattern)
// or a checklist (every cyclePattern member due every day — the streak calendar's "how many of
// today's children got checked" coloring only has meaning under this second mode).
export const RECURRING_MODES = ['rotation', 'checklist'] as const;
export type RecurringMode = (typeof RECURRING_MODES)[number];

export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    // Self-reference is what makes tree depth unbounded "for free" (brief §5 notes).
    // Cascade delete: deleting a node deletes its entire subtree — the brief explicitly
    // says deletion can be "a real local delete" with no tombstone/orphan-handling concept,
    // so cascading through the tree is the direct reading of that (flagged by planning-analyst
    // as originally unspecified; the UI layer is responsible for confirming before a delete
    // that would take a whole subtree with it).
    parentId: text('parent_id').references((): any => goals.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    isComplete: integer('is_complete', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    lifecycleState: text('lifecycle_state', { enum: LIFECYCLE_STATES }).notNull().default('active'),
    stateChangedAt: integer('state_changed_at', { mode: 'timestamp_ms' }).notNull(),
    scheduleType: text('schedule_type', { enum: SCHEDULE_TYPES }).notNull().default('one-shot'),
    timeOfDay: text('time_of_day'), // "HH:MM", nullable
    rangeStart: text('range_start'), // "YYYY-MM-DD", date-range type only
    rangeEnd: text('range_end'), // "YYYY-MM-DD", date-range type only
    cyclePattern: text('cycle_pattern', { mode: 'json' }).$type<string[]>(), // ordered child ids, recurring type only
    cycleStartedAt: text('cycle_started_at'), // "YYYY-MM-DD", day 0 of the rotation
    recurringMode: text('recurring_mode', { enum: RECURRING_MODES }).notNull().default('rotation'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (table) => [index('goals_parent_id_idx').on(table.parentId)],
);

export const completionLog = sqliteTable(
  'completion_log',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // "YYYY-MM-DD"
    // Which child was due that day, for recurring parents — nulled (not cascaded) if that
    // child node is later deleted, so history isn't silently lost along with it.
    childId: text('child_id').references(() => goals.id, { onDelete: 'set null' }),
    completed: integer('completed', { mode: 'boolean' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('completion_log_goal_id_idx').on(table.goalId),
    index('completion_log_date_idx').on(table.date),
  ],
);

export const THEME_OPTIONS = ['system', 'light', 'dark'] as const;
export type ThemeOption = (typeof THEME_OPTIONS)[number];

export const INDICATOR_STYLES = ['ring', 'battery'] as const;
export type IndicatorStyle = (typeof INDICATOR_STYLES)[number];

// Multiplies NativeWind's rem base (see app/_layout.tsx), rescaling every rem-based utility
// class app-wide — text size, padding, gap, radius — with no per-component changes needed.
export const FONT_SCALE_STEPS = [0.85, 1, 1.15, 1.3] as const;
export type FontScale = (typeof FONT_SCALE_STEPS)[number];
export const DEFAULT_FONT_SCALE: FontScale = 1;

/**
 * Single-row table (id is always 1) for device-local app preferences — brief §8.3's Settings
 * screen. Not part of brief §5's data model (that's goal data), but kept in the same SQLite
 * database rather than reaching for a second storage mechanism like AsyncStorage: the brief's
 * hard constraint is "local SQLite storage — the only storage layer" (§10), and a second engine
 * for prefs would quietly violate that even though prefs aren't "goal data" per se.
 */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  theme: text('theme', { enum: THEME_OPTIONS }).notNull().default('system'),
  indicatorStyle: text('indicator_style', { enum: INDICATOR_STYLES }).notNull().default('ring'),
  showArchived: integer('show_archived', { mode: 'boolean' }).notNull().default(false),
  staleDays: integer('stale_days').notNull().default(14),
  dueSoonHours: integer('due_soon_hours').notNull().default(2),
  // Trailing-window length for a recurring node's own progress contribution (brief §2's
  // amendment: "default: 30 days, tunable").
  recurringWindowDays: integer('recurring_window_days').notNull().default(30),
  // User-selectable, global (not per-goal) accent colors — one per visual surface, per user
  // request. Supersedes the earlier per-root-goal hashed accent color (see PROGRESS.md §3).
  progressColor: text('progress_color').notNull().default('#2563eb'),
  calendarColor: text('calendar_color').notNull().default('#0891b2'),
  checkboxColor: text('checkbox_color').notNull().default('#65a30d'),
  // Rescales text/spacing app-wide (brief §8's "comfortable thumb-sized tap targets") — see
  // FONT_SCALE_STEPS above and app/_layout.tsx's rem.set() effect.
  fontScale: real('font_scale').notNull().default(DEFAULT_FONT_SCALE),
});
