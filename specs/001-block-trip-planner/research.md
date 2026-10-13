# Research: Block-Based Trip Planner (Core)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-12

Each entry: Decision / Rationale / Alternatives considered.

## R1. Overall stack

- **Decision**: TypeScript everywhere. pnpm workspace with a framework-free `packages/core`, a
  React + Vite web app in `apps/web`, and Supabase (Postgres, Auth, Realtime) as the backend.
- **Rationale**: Chosen by the user. Supabase provides sign-in, password reset, row-level
  security, and realtime change feeds without writing a server. A plain-TS core can be reused by
  a future React Native/Expo app (constitution III).
- **Alternatives**: Firebase (document DB, more lock-in); Expo for web+mobile now (weaker web
  drag-and-drop/grid); custom Node backend (much more to build).

## R2. Keeping the core portable (constitution III, IV)

- **Decision**: `packages/core` holds domain types, pure state operations, validation, undo/redo,
  and suggestion matching. It depends on no DOM, React, or Supabase code, and uses no
  platform globals: id generation uses the pure-JS `uuid` package (v4), since React Native's
  engine lacks `crypto.randomUUID`. Persistence and auth go
  through `TripRepository` and `AuthService` interfaces defined in core
  ([contracts/core.md](./contracts/core.md)); `apps/web` provides Supabase implementations.
- **Rationale**: Mobile reuses core plus its own adapters; core is unit-testable in Node.
- **Alternatives**: Calling Supabase directly from React components (blocks reuse and testing).

## R3. Sign-in method

- **Decision**: Email + password via Supabase Auth, including email confirmation and password
  reset. Social login deferred.
- **Rationale**: Covers FR-017 with the least setup; Google sign-in can be added later without a
  data change.
- **Alternatives**: Magic links only (awkward on mobile later); Google only (excludes some users).

## R4. Data shape and ordering

- **Decision**: Normalized Postgres tables (trips, blocks, day_settings, items, placements); days
  are derived from the trip's date range, not stored. Order within blocks and cells uses
  fractional-index string keys (`fractional-indexing` library).
- **Rationale**: Inserting or moving between two neighbors updates one row only, which keeps
  sync traffic small and makes concurrent reorders on two devices safe.
- **Alternatives**: Integer positions (renumbering many rows per move); one JSON document per
  trip (simple, but every edit rewrites the whole trip and conflicts are coarse).

## R5. Sync and conflicts (FR-019, SC-007)

- **Decision**: Optimistic local updates. Every change is applied to in-memory state by core,
  then written to Supabase as a row upsert/delete. Other devices receive it via a Supabase
  Realtime `postgres_changes` subscription filtered by `trip_id`. Conflict rule: last write wins
  per row, ordered by server `updated_at`.
- **Rationale**: Matches the spec's "most recent change wins" at the level of a single
  placement/block/item, which is the unit users edit. Realtime delivery is typically < 1 s,
  well within SC-007's 5 s.
- **Notes**: Realtime DELETE events cannot be filtered, and with RLS enabled their old record
  contains only the primary key. The client subscribes to INSERT/UPDATE filtered by `trip_id`
  and to DELETE unfiltered, applying a delete only when it holds a row with that key (`id`, or
  `trip_id` + `date` for `day_settings`).
- **Pending local edits**: A row with a save still in the outbox ignores incoming remote changes
  for that row until its save is confirmed; then the server's `updated_at` is adopted. This stops
  the echo of an older save from briefly overwriting a newer local edit.
- **Alternatives**: CRDT library (e.g. Yjs) — handles offline merges, but offline editing is out
  of scope and it adds significant complexity (constitution V).

## R6. Failed saves (FR-020)

- **Decision**: Writes go through a small outbox in the web adapter. Failures are classified:
  network errors, HTTP 5xx and 429 are transient — the batch stays in the outbox, a persistent
  "Not saved — retrying" banner is shown, and writes retry with backoff and on reconnect. Other
  4xx and Postgres constraint/RLS errors are permanent — the batch is dropped, the trip is
  reloaded from the server, and the user sees "A change couldn't be saved and was undone". The
  outbox is mirrored to `localStorage` so a reload does not lose it.
- **Rationale**: Satisfies "tell the user and never silently discard" without full offline mode.
- **Alternatives**: Blocking the UI on each save (slow, violates the spreadsheet feel).

## R7. Undo / redo (FR-015)

- **Decision**: Command pattern in core. Each planning action is a command that produces the
  new state plus its inverse. Undo applies the inverse as a normal new change (so it syncs like
  any edit). History is per trip, in memory, session-only.
- **Rationale**: Pure, testable, and works identically on mobile.
- **Alternatives**: State snapshots (simple but undo would overwrite other devices' edits).

## R8. Drag and drop (FR-011, FR-013)

- **Decision**: `@dnd-kit/core` + `@dnd-kit/sortable`.
- **Rationale**: Supports mouse, touch, and keyboard dragging with screen-reader announcements,
  which covers the keyboard-accessible requirement and WCAG AA (constitution II).
- **Alternatives**: Native HTML5 drag-and-drop (no touch support); react-beautiful-dnd
  (unmaintained).

## R9. Styling (FR-021, constitution II)

- **Decision**: Plain CSS Modules plus a single `tokens.css` of CSS custom properties (colors,
  spacing, radii, typography, shadows), with light and dark values. Lint rule (stylelint
  `declaration-strict-value`) forbids raw colors, radii, shadows, fonts, spacing, and font sizes
  outside `tokens.css`.
- **Rationale**: Enforces "tokens only" mechanically, no extra framework, and tokens map
  directly to a future React Native theme object.
- **Alternatives**: Tailwind (fine, but a second vocabulary for tokens); a component library
  (harder to get the custom soft look).

## R10. Account deletion (FR-018a)

- **Decision (trips)**: `trips.deleted_at` soft delete. Deleted trips are hidden from the list,
  restorable via an "Undo" message or a "Recently deleted" section, and purged 30 days later by
  the same daily job as accounts (constitution I: reversible without data loss).
- **Decision (accounts)**: `profiles.deletion_requested_at` timestamp. "Delete account" sets it via an
  RPC and signs the user out. On every sign-in the client calls `cancel_account_deletion()`,
  which clears it and reports whether a deletion was cancelled. A daily `pg_cron` job deletes
  `auth.users` rows whose request is older than 30 days; all trip data cascades.
- **Rationale**: No extra server; deletion and restore are both single-row changes.
- **Alternatives**: Edge Function + scheduler (more moving parts for the same result).

## R11. Testing

- **Decision**: Vitest for `packages/core` (unit) and `apps/web` (component + adapter tests);
  Vitest integration tests against a local Supabase (CLI, Docker) for schema, RLS, and RPCs;
  Playwright for end-to-end flows, including a two-browser-context sync test and a
  360px-viewport + keyboard-only run (SC-006).
- **Rationale**: Covers constitution V (core logic tested) and the spec's measurable outcomes.

## R12. Hosting

- **Decision**: Static web build on any static host (e.g. Vercel or Netlify); Supabase cloud
  project for backend. Only the Supabase URL and anon (public) key are in the client; the
  service-role key is never shipped (constitution IV).
