# Testing

How Klados gets verified, at two tiers: automated unit tests for pure logic, and a manual checklist for everything that needs a real device/emulator (UI, persistence, animation feel). The `qa-tester` subagent (`.claude/agents/qa-tester.md`) owns running both before any milestone is declared done.

---

## 1. Automated unit tests

**Stack:** Jest + `@testing-library/react-native`, run via `npm test`.

### What's worth unit-testing

Per [`TECH-STACK.md`](./TECH-STACK.md) §3, the pure logic in `lib/` (no React, no SQLite import) is where automated tests earn their keep — deterministic inputs/outputs, no device needed:

- **Progress roll-up** (brief §2) — the recursive average function. Test directly against the brief's own worked example: a node with 2 children, one at 50% (4 grandchildren, 2 done) and one at 0% (4 grandchildren, 0 done), must roll up to exactly 25%.
- **Rotation-cycle due-child calculation** (brief §4) — `cycle_pattern[(today - cycle_started_at) % cycle_pattern.length]`. Test across a full cycle (day 0, 1, 2, 3, 4 for a 4-length pattern) and a boundary case (cycle starting today).
- **Staleness detection** (brief §7) — a node's subtree with a last-completion timestamp N days ago should flag stale iff N > threshold (default 14), and never flag a Paused node regardless of N.
- **Home-screen surfacing sort** (brief §6) — given a mixed list of overdue-timed, due-soon-timed, untimed-recurring-due-today, and plain leaves, assert the output ordering matches the four-tier priority exactly, respects the ~5-item cap, and excludes Paused/Archived nodes entirely.
- **Recurring node trailing-window completion rate** (brief §2 amendment) — % of due instances completed in the last 30 days, tested with a synthetic `completion_log`.

### Where tests live

Co-located, one `__tests__/` dir per pure-logic module: `lib/rollup.ts` → `lib/__tests__/rollup.test.ts`, and likewise `lib/cycles.ts`, `lib/staleness.ts`, `lib/surfacing.ts`, `lib/accentColor.ts`, and `components/indicators/geometry.ts`. Not tested this way: anything that touches the DB directly (`lib/goals.ts`, `lib/completionLog.ts`, `lib/settings.ts`) — see the note below.

### What's deliberately *not* unit-tested

`lib/goals.ts`, `lib/completionLog.ts`, and `lib/settings.ts` call `expo-sqlite` directly and aren't covered by the automated suite — mocking a real SQLite connection is more test infrastructure than this project has needed so far. Their correctness is verified via the manual checklist below plus the `independent-reviewer` subagent reading the code against the brief at each milestone. Revisit this if a bug ever slips through that a DB-level test would have caught.

### Running

```bash
npm test              # single run
npm test -- --watch   # watch mode during active development
```

---

## 2. Manual QA checklist (on-device/emulator)

Everything below needs Expo Go or the Android emulator running — see [`ENVIRONMENT-SETUP.md`](./ENVIRONMENT-SETUP.md). This checklist mirrors the brief's own §13 "Definition of Done" almost verbatim, turned into concrete steps.

### MVP checklist

- [ ] Create a tree at least 4 levels deep (matching the brief's "Improve Career" worked example in §1).
- [ ] Edit a node's title/description; confirm it persists after navigating away and back.
- [ ] Delete a node with children; confirm children are handled sensibly (brief doesn't mandate cascade behavior explicitly — flag to `solution-architect` if ambiguous when this is implemented).
- [ ] Move a node to a different parent.
- [ ] Toggle a leaf complete/incomplete; confirm the parent's progress recomputes correctly, and walks all the way up to root.
- [ ] Cross-check the rollup math against the brief §2 worked example (25% case) using real UI interaction, not just the unit test.
- [ ] Switch between Drill-down and Outline views; confirm both show the same live data with no reload/duplication artifacts.
- [ ] **Force-quit the app and reopen it** — confirm the entire tree and all completion state survived (proves local SQLite persistence actually works, not just in-memory state).
- [ ] With the device's network disabled (airplane mode), confirm the app works identically — proves zero network calls anywhere.

### Phase 1.5 checklist

- [ ] Create a recurring node with a rotation cycle (the brief's Fitness → `[Gym, Gym, Gym, Swimming]` example); confirm today's due child matches the day-count formula.
- [ ] Log a completion for a recurring instance; confirm it writes to `completion_log` with the correct `child_id`.
- [ ] Open the Streak Calendar for that recurring node; confirm the heatmap cells match the log exactly.
- [ ] Create a date-range node with child windows; confirm the sequential-window visualization matches the configured spans.
- [ ] Set a `time_of_day` on a node; let it pass uncompleted; confirm it surfaces first on Home under "Overdue timed tasks," ordered soonest-passed-first.
- [ ] Create a due-within-2-hours timed task; confirm it surfaces under "Due-soon," ordered by time ascending.
- [ ] Confirm Paused and Archived nodes never appear on Home regardless of their timing.
- [ ] Leave a node's subtree untouched for longer than the staleness threshold (or temporarily lower the threshold in Settings to test faster); confirm the stale badge appears, and disappears once paused.

### General regression pass (run before any export)

- [ ] Light and dark theme both render correctly, including the per-root-goal accent color carrying through every row/progress fill in that branch.
- [ ] Both progress indicator styles (segmented ring, 3D battery bar) render correctly and toggle live from Settings.
- [ ] No console warnings/errors in the Metro/dev console during a full walkthrough of every screen in brief §8.3.

---

## 3. Verifying "zero network calls"

Since the brief's non-negotiable constraint is full offline operation, periodically confirm it directly rather than assuming:

- Run the app with the device in airplane mode (covered above), or
- Use Metro's own network inspector / a proxy (e.g. `adb` + a local proxy tool) to watch for any outbound request while exercising the app. There should be none, ever.
