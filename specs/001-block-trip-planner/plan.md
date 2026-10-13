# Implementation Plan: Block-Based Trip Planner (Core)

**Branch**: `001-block-trip-planner` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-block-trip-planner/spec.md`

## Summary

A signed-in traveler plans a trip on a spreadsheet-like grid of days × shared time blocks. They
type events straight into cells (with suggestions from a per-trip activity & food list) or drag
list items in as independent copies, customize blocks, mark arrival/departure per day, and undo
freely. Trips sync across the user's devices.

Technical approach: a framework-free TypeScript core holds all domain rules, undo, and merge
logic; a React + Vite web app renders it; Supabase provides Postgres with row-level security,
email/password auth, and realtime change feeds. Edits are applied optimistically, saved as
per-row upserts through an outbox, and merged last-write-wins per row ([research.md](./research.md)).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS for tooling

**Primary Dependencies**: React 19, Vite, @supabase/supabase-js v2, @dnd-kit/core +
@dnd-kit/sortable, fractional-indexing, React Router

**Storage**: Supabase Postgres (tables in [data-model.md](./data-model.md)); `localStorage`
only for the unsaved-changes outbox

**Testing**: Vitest (core, web, DB integration against local Supabase), Playwright (e2e)

**Target Platform**: Evergreen desktop and mobile browsers (last 2 versions of Chrome, Safari,
Firefox, Edge); core reusable by a future React Native/Expo app

**Project Type**: Web application (pnpm monorepo: shared core package + web app + Supabase
project)

**Performance Goals**: Local edits render within 100 ms; cross-device sync visible within 5 s
(SC-007); trip with 60 days × 10 blocks × 300 placements stays responsive

**Constraints**: Online required (offline editing out of scope); no secrets in client; WCAG 2.1
AA; usable at 360 px; design tokens only

**Scale/Scope**: Personal use first; tens of users, ≤ 50 trips per user, ≤ 500 items/placements
per trip; ~8 screens/dialogs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Pre | Post |
|---|---|---|---|
| I. Flexible block-based planning | User-defined blocks (FR-006), typed + dragged placements, any number per cell, undo/redo for every planning action (R7); deleted trips restorable for 30 days (R10) | ✅ | ✅ |
| II. Clean, friendly interface | `tokens.css` + stylelint rule (R9); mobile-first layout; dnd-kit keyboard/touch drag (R8); type and arrival/departure greying shown by icon + label, not color alone; 360 px + keyboard e2e (quickstart #14) | ✅ | ✅ |
| III. Portable core | All rules in `packages/core` with no DOM/React/Supabase imports; UI uses only [contracts/core.md](./contracts/core.md) | ✅ | ✅ |
| IV. Integrations behind adapters | Supabase used only through `TripRepository` / `AuthService` ports; only anon key in client; no AI/location in this feature | ✅ | ✅ |
| V. Simplicity & verified changes | No CRDT, no offline mode, no social login; core fully unit-tested; RLS tested | ✅ | ✅ |
| Constraints: data minimization | Only trip data the user enters is stored; no third parties beyond Supabase | ✅ | ✅ |
| Workflow | spec → clarify → plan done; tasks next | ✅ | ✅ |

No violations. Post-design re-check: the outbox (R6) and fractional ordering (R4) are the only
non-obvious mechanisms; both are required by FR-020 and FR-019 respectively and are recorded
under Complexity Tracking for visibility.

## Project Structure

### Documentation (this feature)

```text
specs/001-block-trip-planner/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── core.md          # @cellar/core public interface + platform ports
│   └── database.md      # tables, RLS, RPCs, scheduled job
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
packages/core/
├── src/
│   ├── model/           # types, validation
│   ├── commands/        # trip, block, daySetting, item, placement commands
│   ├── queries/         # days, cell, isGreyed, filterItems, suggestItems
│   ├── history.ts       # undo/redo
│   ├── merge.ts         # applyRemote (last-write-wins)
│   ├── ports.ts         # TripRepository, AuthService interfaces
│   └── index.ts
└── tests/

apps/web/
├── src/
│   ├── adapters/        # supabaseTripRepository, supabaseAuthService, outbox
│   ├── state/           # trip store wiring core + repository + history
│   ├── components/      # Grid, Cell, PlacementCard, ItemList, BlockEditor, DayHeader, ...
│   ├── pages/           # SignIn, SignUp, ResetPassword, Trips, TripPlanner, Settings
│   ├── styles/tokens.css
│   └── main.tsx
├── tests/               # component + adapter tests
└── e2e/                 # Playwright

supabase/
├── migrations/          # schema, RLS, triggers, RPCs, pg_cron job
└── tests/               # DB integration tests (Vitest)
```

**Structure Decision**: Monorepo with one shared core package, one web app, and the Supabase
project. A future `apps/mobile` will depend on `packages/core` and supply its own adapters.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Save outbox with retry (R6) | FR-020: failed saves must not be silently lost | Blocking saves make every edit wait on the network |
| Fractional-index positions (R4) | Concurrent reorders on two devices (FR-019) without renumbering rows | Integer positions rewrite many rows per move and conflict across devices |
