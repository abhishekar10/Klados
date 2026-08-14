# Tech Stack — Pinned & Rationale

Companion to [`PROJECT-BRIEF.md`](./PROJECT-BRIEF.md) §9. That section says *what* the stack is; this document pins concrete versions and explains *why*, so implementation doesn't quietly drift toward something else.

**Target: Android only.** No iOS Simulator is available on this Linux dev machine (Xcode is Mac-only), and there's no App Store distribution goal — see [`BUILD-AND-EXPORT.md`](./BUILD-AND-EXPORT.md). Nothing here should introduce an iOS-only dependency.

---

## 1. Pinned versions

| Package | Version (at time of writing) | Notes |
|---|---|---|
| `expo` | **SDK 54** (`^54.0.x`) — matched to the tester's actual installed Expo Go, not the newest SDK | Expo Go builds are SDK-locked: a given Expo Go binary supports exactly the one SDK it shipped with, not "that version or older." Newly-released SDKs (56, 57 at time of writing) can sit in app-store review for weeks after `npm`/`expo.dev/go` already show them as current, so "download the latest Expo Go" from Play Store does *not* guarantee it matches whatever SDK is nominally newest — it only guarantees whatever SDK is currently store-approved, which lagged behind by two full majors when this was diagnosed. **Don't guess the SDK from what's newest upstream** — open Expo Go on the actual test device → profile/settings → it reports the exact SDK version it supports. Match the project to that number. To change it: `npx expo install expo@<version>` then `npx expo install --fix` to realign every Expo-managed package. Two things `--fix` does *not* handle, verify by hand after: (1) `@react-native/jest-preset` isn't Expo-managed — re-pin it to match the exact `react-native` version that landed, and note it only exists as a separate package from RN 0.85 onward, so on SDK ≤55 (RN ≤0.83ish) remove it entirely and let `jest-expo` use RN's bundled `react-native/jest-preset.js` instead; (2) `app.json`'s `plugins` array can end up referencing a package (e.g. `expo-status-bar`) that doesn't export a config plugin at the older SDK's version — drop it from `plugins` if `expo install --fix` warns about it. |
| `react-native` | Whatever the Expo SDK bundles | Never upgrade RN independently of the Expo SDK. |
| `typescript` | ^5.x | Strict mode on from day one (`"strict": true` in `tsconfig.json`). |
| `nativewind` | ^4.x | Tailwind-for-RN. v4 compiles at build time (no runtime CSS-in-JS cost). |
| `tailwindcss` | ^3.x | Peer dependency of NativeWind v4. |
| `react-native-reanimated` | via `npx expo install` | Native-thread animations — required for Moti and for the drill-down slide transitions (brief §8.4). |
| `moti` | latest | Declarative animation wrapper over Reanimated — used for the leaf-completion micro-animation and ring/battery fill transitions. |
| `zustand` | ^4.x | Single global store for tree state, UI mode (drill-down/outline), settings. No middleware needed initially (no persistence via Zustand — persistence is SQLite, not localStorage-style). |
| `expo-sqlite` | via `npx expo install` | On-device relational storage — see §2 below. |
| `drizzle-orm` + `drizzle-kit` | latest | Optional thin typed query layer over expo-sqlite (see §2). |
| `eas-cli` | latest, installed globally | Only needed for producing the installable `.apk` — see [`BUILD-AND-EXPORT.md`](./BUILD-AND-EXPORT.md). Not a project dependency. |

Run `npx expo install <package>` (not raw `npm install`) for any RN-native package — it resolves the version that matches the installed Expo SDK, which prevents native-module version mismatches that are otherwise a common source of build breakage.

---

## 2. Why this stack (tied to the brief's requirements)

- **Expo (managed workflow) over bare React Native.** No native module is needed that Expo doesn't already support (SQLite, Reanimated, and file system access are all covered). Managed Expo gives a much faster dev loop (`expo start`, Expo Go on-device) and defers native build complexity until `EAS Build` time, only once, for export.
- **expo-sqlite over AsyncStorage or a NoSQL on-device store.** The data model (brief §5) is fundamentally relational: a self-referencing `parent_id` tree plus a `completion_log` table that needs date-range queries (staleness windows, trailing 30-day recurring completion rate, streak calendars). SQL is the right tool for "sum/average over children," "rows in the last N days," etc. — reimplementing that over a key-value store would mean hand-rolling a query engine.
- **Drizzle ORM (optional, recommended) over raw SQL strings.** Gives compile-time-checked schema/queries against the exact shape in brief §5, without the overhead of a heavier ORM. Raw `expo-sqlite` calls remain a fallback for anything Drizzle makes awkward (e.g. the recursive ancestor-chain walk in the rollup recompute).
- **Zustand over Redux/Context.** The brief's state is comparatively simple (current tree slice, UI mode, settings) and doesn't need Redux's ceremony. Zustand's selector model also avoids the re-render storms Context is prone to in a deeply nested tree UI.
- **NativeWind over StyleSheet/styled-components.** Keeps the utility-class mental model the brief's original web-planning phase already assumed (§0), and maps directly onto brief §8's "restrained base, richness in specific places" design language via consistent spacing/color tokens.
- **Reanimated + Moti over the RN `Animated` API or Lottie.** Brief §8.4 requires everything (expand/collapse, drill-down slide, completion micro-animation) to run smoothly on the UI thread, never janky. Reanimated is the standard for that in RN; Moti removes most of its boilerplate for simple fade/scale/slide cases.
- **No backend, no auth, no sync package — ever.** This is a hard constraint from brief §0/§9, not a default to reconsider later. If a future task seems to need a network call, that's a signal to stop and re-read the brief, not to add `fetch`.

---

## 3. Proposed project structure

Described here so implementation starts consistent; not created by this planning pass.

This lives at the repo root (`/home/abhishek/Desktop/Klados`), alongside `Planning/` and `.claude/` — not nested in a separate subfolder:

```
Klados/                  # repo root — Planning/ and .claude/ already live here
├─ app/                  # Expo Router screens (Home, Explorer, Node Detail, Settings)
│  ├─ index.tsx          # Home/Welcome screen
│  ├─ explorer/          # Drill-down + Outline views
│  ├─ node/[id].tsx      # Node Detail / Add-Edit
│  └─ settings.tsx
├─ components/           # Shared UI: row component, progress ring, battery bar, streak heatmap
├─ db/
│  ├─ schema.ts          # Drizzle schema mirroring brief §5
│  ├─ client.ts          # expo-sqlite connection setup
│  └─ queries/           # rollup.ts, cycles.ts, staleness.ts, completionLog.ts
├─ store/                # Zustand slices
├─ lib/                  # Pure logic: progress algorithm, rotation-cycle math, surfacing algorithm
│  └─ __tests__/         # Unit tests for the above — see TESTING.md
├─ constants/             # Theme tokens, accent-color palette, default thresholds (staleness, due-soon window)
├─ app.json / eas.json
└─ tsconfig.json
```

Keeping `lib/` (pure functions: rollup math, cycle-due-child calc, staleness check, surfacing sort) free of React/SQLite imports is deliberate — it's what makes those pieces cheaply unit-testable per [`TESTING.md`](./TESTING.md).
