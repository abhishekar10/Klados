# Tracker — Project Brief & Build Spec

**Purpose of this document:** this is a complete, self-contained handoff. It was written after an extended planning conversation (in a Claude session that won't carry over to wherever this app actually gets built) and consolidates everything decided so far — vision, data model, algorithms, UI design, tech stack, and roadmap — into one file. A fresh Claude Code session should be able to read only this document and start building. Nothing here is code yet; this is the spec to build from.

---

## 0. Read this first — what changed from earlier planning

An earlier round of planning assumed a **web app (PWA) with a Supabase cloud backend, multi-user auth, and manual cloud sync**. That assumption was wrong and has been corrected:

- **"Mobile-first" means a real native mobile app** — not a browser-based PWA installed to a home screen.
- **No online functionality at all.** No accounts, no login/signup, no multi-user, no cloud database, no sync, no "Sync Now" button. The app is single-user and fully local — everything lives on the device, nothing talks to a server, ever.
- **No feature changes otherwise.** The goal-tree model, progress rollup math, lifecycle states, scheduling (recurring/date-range/time-of-day), staleness detection, the Home-screen daily-surfacing algorithm, and the UI/UX design are all unchanged from what's specified below.
- **Tech stack is updated accordingly** (§7) — swaps the web/Supabase/PWA stack for a native app stack with purely local, on-device storage. No backend service exists in this project at all.

Everything below already reflects these corrections — there's no need to cross-reference an older version.

---

## 1. Vision

A mobile app for tracking goals that break down into sub-goals, to any depth — not a flat to-do list, but a tree. You set a big goal, break it into steps, break those into steps, and so on until each leaf is something small enough to just *do*. Progress rolls up automatically: finish leaves, watch the parents fill in, watch the top-level goal move. Fully local, fully private, no account required — you open the app and it's just there.

### Worked example (the model's original reference case)

```
Improve Career                                   ← root goal
├─ Setting Expectations                          ← child
│  ├─ Retrospection on career so far              ← grandchild
│  │  ├─ Check how many years you've worked        ← leaf
│  │  └─ Prepare a list of items you've worked on   ← leaf
│  └─ Self-evaluation on career strength
│     ├─ Compare your knowledge with industry norms
│     └─ Assess what you need to be better at
└─ Preparation
   └─ Scouting resources
      └─ Aggregate the companies you want to apply to
```

Any node can have children; any node with no children is a leaf. Depth is unbounded — the data model never assumes a fixed number of levels.

---

## 2. Progress Roll-Up Algorithm

**Leaf nodes** (no children, schedule type = one-shot): progress is binary — 0% (not done) or 100% (done), toggled directly by the user.

**Non-leaf nodes**: progress = the **unweighted average** of their immediate children's progress, applied recursively.

```
function progress(node):
    if node.children is empty:
        return node.isComplete ? 100 : 0
    return average( progress(child) for child in node.children )
```

**Worked check:** a child has 4 grandchildren, 2 complete → that child = 50%. Its sibling has 4 grandchildren, 0 complete → sibling = 0%. Parent (2 children, 8 grandchildren total) = (50 + 0) / 2 = **25%**.

**Recompute strategy:** on any leaf toggle, recompute that leaf's parent, then that parent's parent, walking up to the root (O(depth) per edit, not O(tree)). Cache each node's computed progress; invalidate only the ancestor chain on write.

**Amendment — recurring nodes:** a node marked `recurring` (see §4) doesn't have a permanent 0/100 state — a habit like "Fitness" is ongoing. Its contribution to a parent's average is instead its **trailing-window completion rate** (default: % of due instances completed in the last 30 days, tunable). The rollup formula itself is unchanged; only what a recurring node *reports* as its own progress changes. One-shot and date-range nodes keep the binary/averaged model above.

---

## 3. Lifecycle States

Every node (any type, any depth) carries a lifecycle state:

```
        ┌─────────┐   pause    ┌─────────┐
        │ Active  │ ─────────► │ Paused  │
        │         │ ◄───────── │(On-hold)│
        └────┬────┘   resume   └────┬────┘
             │                      │
     complete│                archive│ (abandon while paused)
             ▼                      │
        ┌─────────┐                 │
        │Complete │                 │
        └────┬────┘                 │
             │ archive               │
             ▼                      ▼
        ┌─────────────────────────────┐
        │          Archived            │
        └─────────────────────────────┘
```

- **Active** — default, currently being worked on.
- **Paused/On-hold** — explicit, user-triggered ("some days you just can't make it"). Paused nodes are excluded from Home-screen surfacing (§6) and from staleness flags (§9) — pausing is an honest signal, not neglect.
- **Complete** — only reachable by **one-shot** and **date-range** nodes. **Recurring nodes have no natural Complete state** — a habit like "Fitness" is evergreen; it's Active until you decide to stop, at which point it goes straight to Archived.
- **Archived** — off the main view, kept for history (streak data, past completions). Reachable from Active, Paused, or Complete.

State changes are timestamped — this drives staleness detection (§9).

---

## 4. Node Scheduling Types

Scheduling is an *optional layer* on top of the same tree — it doesn't create a different kind of node.

| Type | Example | What it means |
|---|---|---|
| **One-shot** (default) | "Check how many years you've worked" | Complete once, stays complete. |
| **Recurring** | Fitness → rotates Gym, Gym, Gym, Swimming | Defines a repeating cycle across its children (or itself if a leaf habit). Generates a completion event per cycle instance instead of one permanent complete/incomplete. |
| **Date-range** | DSA (2 months) → Arrays (weeks 1–2), Hashmaps (weeks 3–4)... | The parent's overall span is divided into sequential windows, one per child. A scheduling/visualization overlay — doesn't change how that child's own progress is tracked. |

**Time-of-day** is a separate, orthogonal tag any node can carry (one-shot, recurring, or date-range) — e.g. "Wake up at 6:00am," "Freshen up at 6:15am." Editable at any point after creation. Drives Home-screen ordering (§6).

**Rotation cycles (recurring nodes):** a fixed, ordered list of child references that repeats indefinitely from an activation date — e.g. `[Gym, Gym, Gym, Swimming]` repeating every 4 days. Today's due child = `cycle_pattern[ (today - cycle_started_at) % cycle_pattern.length ]`. This is a **rolling, day-count-based cycle**, not pinned to calendar weekdays (simpler, matches "3 days gym, 4th day swimming" literally). Weekday-pinned scheduling is a reasonable v2 addition if the rolling cycle drifts awkwardly in practice.

---

## 5. Data Model

Single local user — no `user_id`, no per-row ownership, no row-level security. Everything below lives in one on-device database (see §7 for the specific engine).

```
goals
  id                text/uuid, primary key
  parent_id         nullable, self-reference to goals.id   -- unlimited depth "for free"
  title             text
  description       text, nullable
  is_complete       boolean            -- meaningful only for one-shot leaves; derived/ignored otherwise
  sort_order        integer            -- ordering among siblings
  lifecycle_state   enum('active','paused','complete','archived'), default 'active'
  state_changed_at  timestamp          -- when lifecycle_state last changed; drives staleness math
  schedule_type     enum('one-shot','recurring','date-range'), default 'one-shot'
  time_of_day       time, nullable     -- editable, drives Home-screen surfacing
  range_start       date, nullable     -- date-range type only
  range_end         date, nullable     -- date-range type only
  cycle_pattern     json, nullable     -- recurring type only, ordered child refs, e.g. ["gym","gym","gym","swim"]
  cycle_started_at  date, nullable     -- recurring type only, day 0 of the rotation
  created_at        timestamp
  updated_at        timestamp

completion_log      -- powers streak calendars and "was today's instance done"
  id
  goal_id       references goals.id
  date          date
  child_id      references goals.id, nullable  -- which child was due that day, for recurring parents
  completed     boolean
  completed_at  timestamp, nullable
```

Notes:
- `parent_id` self-reference is what makes depth unlimited "for free" — no separate table per level, no schema change ever needed to go one level deeper. Whether a node is a leaf is derived (does anything reference it as `parent_id`?), not stored.
- No `deleted_at` tombstone is needed (that existed only to support cloud sync, which no longer exists) — deletion can be a real local delete. If undo-delete is wanted later, a simple local trash/soft-delete can be added independently of any sync concern.
- No `updated_at`-for-conflict-resolution concept applies anymore — `updated_at` is kept only as generically useful bookkeeping (sorting, "recently touched" for the Home-screen fallback in §6).

---

## 6. Home Screen — Daily Surfacing Algorithm

The Home/Welcome screen is the app's landing screen — a greeting, a short list (cap ~5) of "today's tasks," and a prominent CTA button (e.g. "Get me there") into the main tree explorer. It is deliberately *not* just the root-goals list.

Priority order for the "today's tasks" list, top to bottom:

1. **Overdue timed tasks** — any Active node with a `time_of_day` whose time has already passed today and isn't yet complete for today (one-shot: not complete; recurring: today's `completion_log` entry missing/false). Ordered soonest-passed-first. *(Example: it's 6:20am, "Freshen up" was due 6:15am → shows first.)*
2. **Due-soon timed tasks** — Active, timed, due within the next ~2 hours, not yet complete. Ordered by time ascending.
3. **Untimed recurring tasks due today** — today's cycle instance not yet logged, no specific clock time attached.
4. **Fallback fill** (only if slots remain under the cap) — untimed one-shot leaves, most-recently-touched first.

Paused and Archived nodes never appear here, regardless of timing. The "due soon" window (2 hours) and fallback ordering are tunable defaults — ideally exposed in Settings rather than hardcoded.

---

## 7. Staleness Detection

An **Active** node (any type) is flagged **stale** if its subtree has had no completion event (no leaf toggle, no `completion_log` entry) in more than a threshold window (default: **14 days**, tunable). Flagged nodes get a subtle visual marker in the explorer (small badge/dot, not a loud banner). Paused nodes are exempt.

---

## 8. UI/UX Design

### 8.1 Design Principles
**Restrained base, richness where it earns its keep.** Backgrounds, typography, spacing, most surfaces stay clean and neutral. Visual richness (color, depth, motion) concentrates in two places: **progress indicators** and **primary actions (CTAs)**. Not uniformly minimal, not uniformly bold — calm everywhere except where you're meant to look.

**File-explorer, not node-graph.** Every view of the goal tree is a list of indented rows with expand/collapse chevrons — like the VS Code sidebar. No boxes-and-connecting-lines diagram anywhere in the app.

### 8.2 Navigation
Two interchangeable views of the same data, switchable from a top-bar control:
- **Drill-down (default):** tap a goal → screen shows only its children, with a breadcrumb trail back up (`Career > Setting Expectations`). Good for focus, one-handed use.
- **Outline:** single scrollable screen, VS Code-explorer style — every visible node indented by depth, chevron expands/collapses children in place. Good for seeing more of the tree's shape at once.

Both modes read the same underlying data — switching doesn't reload or duplicate anything.

### 8.3 Screens
- **Home/Welcome** — landing screen, per §6. Greeting, fading daily-tasks list, CTA into the explorer. (No login gate — this is the very first thing the app shows on open.)
- **Main Explorer — Drill-down** — breadcrumb top bar, mode toggle, list of current level's children (title + progress indicator + chevron-if-parent), "add node here" affordance scoped to current level. Tapping a leaf opens Node Detail directly.
- **Main Explorer — Outline** — same data, nested indented rows, same row component.
  - **Row states (both modes):** Paused nodes render dimmed/muted. A small stale-flag badge appears on Active nodes past the staleness threshold. Archived nodes are hidden by default, reachable via a "Show archived" toggle in Settings.
- **Node Detail / Add-Edit** — title, description, breadcrumb. **Schedule type** selector (One-shot / Recurring / Date-range) changes the fields shown: one-shot gets a complete toggle (leaves only); recurring gets a cycle-pattern editor (ordered children with repeats) plus a "started on" date, and links to its Streak Calendar; date-range gets start/end date pickers. **Time of day** field, optional, editable anytime. **Lifecycle actions**: Pause/Resume, Archive, Delete, move-to-different-parent. Children list (if any), tapping drills in.
- **Streak Calendar** (recurring nodes only) — GitHub-contributions-style heatmap sourced from `completion_log`: one cell per day, filled if that day's due instance was completed. Lives inside Node Detail for a recurring node, not a separate top-level screen.
- **Settings** — Theme (light/dark). Progress-indicator style: segmented ring vs. 3D battery bar (§8.5) — global toggle. Show archived nodes toggle. Staleness threshold and "due soon" window as editable values (defaults 14 days / 2 hours). *(No account/logout, no sync section — neither exists in this app.)*

There is **no Auth screen and no sync-status affordance** — both are removed entirely; the app opens straight to Home.

### 8.4 Visual Language
- **Color:** neutral base palette (light + dark themes) plus a **per-root-goal accent color**, used consistently for every row and progress fill anywhere in that branch — so each top-level goal's whole subtree reads in one color family. This is what makes the app feel colorful without being visually loud.
- **Typography & spacing:** mobile-first type scale, comfortable thumb-sized tap targets, consistent indentation step per depth level in Outline mode.
- **Iconography:** parent nodes get a folder-style affordance with a chevron; leaf/one-shot nodes get a checkbox/circle; **recurring nodes get a distinct cycle/rotation glyph** so a habit reads differently from a one-time task at a glance.
- **Motion:** expand/collapse is quick and eased, never an abrupt cut; completing a leaf gets a distinct, satisfying micro-animation (a moment of reward — allowed a bit of flourish); drill-down navigation uses a directional slide (forward = in, back = out) so the hierarchy feels spatial. Exact durations/easing are implementation details — the rule is "always animated, never instant, never sluggish."

### 8.5 Progress Indicator — Two Variants (global Settings toggle, not per-node)

**Segmented ring ("sliced cake"):** the ring divides into as many wedge segments as the node has immediate children (e.g. 4 children = 4 equal wedges tiling the full circle). Segment boundaries are smooth/rounded, not sharp spokes. Each wedge is filled independently to *that specific child's own progress percentage* — wedge size marks "one child's share," wedge fill shows that child's progress. Leaf nodes (no children) fall back to a single simple ring, filled 0% or 100%.

**3D battery bar:** a horizontal capsule with a skeuomorphic bevel/gradient/depth treatment (the deliberate "3D-esque" richness spot, contrasting with the flat/minimal base UI elsewhere). Fills left-to-right like an iPhone battery indicator, percentage numeral rendered inside the bar.

**Recurring nodes:** both variants render the same way, but the fill value is the trailing-window completion rate (§2's amendment), not a permanent 0/100.

---

## 9. Tech Stack (native mobile, fully local — no backend)

| Layer | Choice | Why |
|---|---|---|
| App framework | **React Native + Expo** | Cross-platform (iOS + Android) from one codebase; carries over the React/TypeScript thinking already baked into this design; Expo gives a fast dev loop and a path to an installable build without needing deep native tooling. |
| Language | TypeScript | Same as originally planned. |
| Styling | NativeWind (Tailwind-for-React-Native) | Keeps the same utility-class mental model as the original web plan. |
| Animation | Reanimated / Moti | React Native's standard for smooth, native-thread animation — the RN equivalent of the originally-planned Framer Motion. |
| State | Zustand | Unchanged — works the same in React Native. |
| **Local storage** | **expo-sqlite** (real SQL, on-device) | Replaces the original browser-only IndexedDB/Dexie plan, which doesn't exist in a native app. SQLite fits this data model well — it's relational (parent_id tree, completion_log with date queries for streaks/staleness/cycle math). A lightweight query layer or an ORM like Drizzle can sit on top if convenient; raw SQL is also fine. |
| Backend | **None.** | No Supabase, no Postgres, no server of any kind. All reads/writes are local SQLite calls. |
| Auth | **None.** | No login, no accounts, no sessions. |
| Sync | **None.** | Removed entirely — was only relevant for multi-device/multi-user, neither of which applies now. |
| Distribution | **Expo Go** (during development, instant on-device testing without a build) → **EAS Build** (produces an installable app binary once ready) | No app-store publishing is required for personal use — an Android `.apk` can be installed directly (sideloaded). iOS is more locked down (see §11 open question). |

---

## 10. Feature Scope & Roadmap

### MVP
- Recursive goal tree: create/edit/delete/move nodes, unlimited depth
- One-shot leaf complete/incomplete toggle; progress auto-rolls up the tree
- Tree view (drill-down) and outline view, toggleable
- Local SQLite storage — the only storage layer, no network calls anywhere
- Lifecycle states: Active / Paused / Complete / Archived

### Phase 1.5 — Scheduling & Habits
- Recurring nodes with rotation cycles + `completion_log`
- Date-range nodes (sequential per-child windows within a parent's span)
- Time-of-day tagging, editable
- Home-screen daily-surfacing algorithm (§6)
- Staleness detection/flagging (§7)
- Streak calendar per recurring node

### Phase 2
- Drag-and-drop reorder / re-parent nodes
- Notes per node
- Search/filter across the tree
- *(No sync phase — there is nothing to sync to.)*

### Phase 3
- Polish/animation pass, app icon/splash screen, EAS Build for an installable binary

### Build order
1. Scaffold Expo + TypeScript project, set up expo-sqlite schema (§5, including Phase 1.5 columns/table)
2. MVP core: recursive tree CRUD UI, one-shot rollup logic, lifecycle states — test live in Expo Go on-device
3. Phase 1.5: recurring/date-range/time-of-day, surfacing algorithm, staleness, streak calendar
4. Phase 2 extras
5. Phase 3 polish + EAS Build for a real installable app

### Productivity feature suggestions (stretch — pick what's actually useful once the above is live)
| Feature | Why it helps |
|---|---|
| Goal templates (job search, fitness, learning plan) | Skip the blank-page problem for common goal types |
| Radial/sunburst or breadcrumb visualization | A big tree gets hard to read as nested lists alone |
| Time tracking (effort/duration) per node | Different from time-of-day scheduling — useful where effort, not just completion, matters |
| Optional weighting of children | Not all sub-goals are equally important — v2 toggle, unweighted average stays the default |
| Natural-language quick-add | "Add 3 sub-goals under Preparation: X, Y, Z" — faster than a form when brainstorming |
| Local notifications | On-device reminders tied to time-of-day tasks — still no server needed |
| Gamification (XP/levels/badges) | Optional — matter of taste, easy to over-build; keep low priority |
| Export/import (JSON backup) | Cheap insurance since data is local-only and there's no cloud copy — arguably more important now than in the original cloud-backed plan |
| Dark mode | Expected baseline for a mobile app used daily |

---

## 11. Open Questions / Assumptions

- **Platform target:** if this needs to run on iOS, sideloading a personal build without going through the App Store requires an Apple Developer account (or a tool like AltStore); Android can install an `.apk` directly with no account needed. Which platform(s) this targets should be confirmed before Phase 3.
- **Local backup:** since there's no cloud copy anymore, losing the device (or the app's storage) means losing all data — the export/import (JSON backup) feature listed above is worth prioritizing higher than "stretch," given this tradeoff.
- Do one-shot leaves stay strictly binary (0/100%), or get a partial-credit slider?
- Do children ever need uneven weighting, or does unweighted-average stay the permanent default?
- Trailing-window length for recurring-node progress contribution (proposed 30 days) — tune with real usage.
- Rolling day-count cycles vs. weekday-pinned cycles for recurring nodes — start rolling, revisit if it drifts awkwardly.
- Accent color assignment per root goal: proposed default is auto-assignment from a fixed palette in creation order, with manual override in Node Detail.
- Stale-flag badge and streak-calendar cell styling aren't specified in pixel detail — small visual treatments to design during implementation.

---

## 12. App Name — Candidate Shortlist

A large list of Latin/Greek-derived names was brainstormed and checked against existing trademarks/products via web search (informal check, not a formal legal clearance).

**Likely clear** (no notable existing product/trademark found):
- **Klados** — Greek, "branch" (root of "cladistics," the science of branching classification trees)
- **Cursus** — Latin, "course/path"
- **Fructus** — Latin, "fruit/result"
- **Truncus** — Latin, "trunk" (of a tree)

**Gray zone** (niche/regional collisions, worth a closer look):
- Culmen (Latin, "summit") — collides with a non-consumer gov't contractor
- Dynamis (Greek, "power/potential") — niche tools/gaming brands
- Klimax (Greek, "ladder") — known within hi-fi/audiophile circles (Linn Klimax)
- Physis (Greek, "growth/nature") — small regional app studio

**Avoid** — notably taken, including some near-misses in this app's own space: **Arete** (existing self-improvement/goals app), **Praxis** (ETS exam-prep app), **Dendron** (existing hierarchical notes app), plus many household-name collisions (Telos, Vertex, Radix, Nexus, Ledger, Corona, Keystone, Canopy, Arbor, Cairn, Trellis, Waypoint, Ascent, Foothold, Silva, Cardo, Fulcrum, Summa, Provectus, Ergon, Rhizome, Skopos, Akme, Horme).

Leading picks: **Klados** or **Cursus**. Before committing, check app-store name availability directly and, if this is ever published/commercialized rather than kept personal, run a real trademark clearance search.

---

## 13. Verification / Definition of Done for early milestones

- **MVP done** when: a tree of arbitrary depth can be created, edited, and navigated in both drill-down and outline modes on-device (via Expo Go), leaf completion correctly rolls up progress through multiple levels matching the worked example in §2, and all data survives an app restart (proving local persistence works) with zero network calls made anywhere.
- **Phase 1.5 done** when: a recurring node like the Fitness example correctly computes today's due child from its rotation cycle, logs completion to `completion_log`, its streak calendar renders correctly from that log, and the Home screen surfaces overdue/due-soon timed tasks ahead of everything else per §6.
