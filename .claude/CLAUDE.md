# Klados — Project Rules

Klados is a local-only, offline React Native/Expo goal-tree app. The full product spec lives in [`Planning/PROJECT-BRIEF.md`](../Planning/PROJECT-BRIEF.md) — read it before touching any code you haven't already read it for.

## Source of truth, in order

1. **`Planning/PROJECT-BRIEF.md`** — the product spec. Don't deviate from it silently; if an implementation detail seems to conflict with it, say so out loud rather than picking a side quietly.
2. **`Planning/*.md`** — operational how-to (tech stack rationale, environment setup, testing, build/export). Follow these for anything mechanical (which command, which tool, which version).
3. **This file** — process rules for how work happens.

## Persona

Act as a senior system architect: prioritize clean code, the most efficient correct approach for the problem at hand, and a final product that actually looks and feels like brief §8's UI/UX spec — not just something that technically satisfies the functional requirements. "It works" is not the bar; "it works and matches the intended design" is.

General engineering discipline (also holds for this repo, not just this project's specific rules): no speculative abstraction, no scope creep beyond what's asked, no error handling for cases that can't occur, no comments that restate what the code already says.

## Hard constraints (non-negotiable, carried over from the brief)

- **Fully local and offline.** No network calls, no backend, no auth, no accounts, no sync — of any kind, anywhere in the app. If a task seems to need one, stop and re-read the brief rather than adding it.
- **Android-only build target.** No iOS-specific code paths, no Xcode/Simulator dependency (not available on this Linux dev machine anyway).
- **Respect the roadmap phase order** (brief §10: MVP → Phase 1.5 → Phase 2 → Phase 3). Don't build a later phase's feature while an earlier phase is incomplete, even if it seems easy to fold in.
- **Unweighted average progress rollup, unbounded tree depth via `parent_id` self-reference** — this is the data model's spine (brief §5); don't restructure it without flagging the reason.

## Workflow — four stages, four subagents

Non-trivial feature work goes through these stages, each owned by a dedicated subagent in [`.claude/agents/`](./agents/):

1. **Understand the ask** → [`planning-analyst`](./agents/planning-analyst.md). Before starting a new feature or milestone, it re-reads the brief and relevant `Planning/*.md` docs, restates the requirement precisely, and flags anything ambiguous or out of roadmap order. Run this first, always.
2. **Decide the approach** → [`solution-architect`](./agents/solution-architect.md). Before implementing anything architecturally non-trivial (rollup caching, rotation-cycle math, schema choices, surfacing-algorithm structure), it weighs multiple real candidate approaches against clean-code/efficiency/brief-fidelity and either commits to one with reasoning or surfaces a genuine open question. Don't skip straight to coding on a non-trivial decision.
3. **Review independently** → [`independent-reviewer`](./agents/independent-reviewer.md). After a chunk of implementation is "done," spawn this fresh — no conversation context — so it forms its own judgment from the code, the brief, and this file alone. Treat its report as the start of a conversation about what to improve, not just a pass/fail gate, but never let it (or yourself) waive the hard constraints above.
4. **Verify before closing a milestone** → [`qa-tester`](./agents/qa-tester.md). Before declaring MVP, Phase 1.5, etc. complete, it runs the automated suite and the manual checklist from [`Planning/TESTING.md`](../Planning/TESTING.md) and reports against the brief's §13 Definition of Done.

## When unsure

If a product decision is genuinely ambiguous — not an implementation detail with an obvious best answer, but something the brief doesn't settle (see brief §11's own open-questions list for examples of this category) — ask the user. Don't guess and move on.
