---

description: "Task list for the Block-Based Trip Planner (Core)"
---

# Tasks: Block-Based Trip Planner (Core)

**Input**: Design documents from `/specs/001-block-trip-planner/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/core.md,
contracts/database.md, quickstart.md

**Tests**: Included. Constitution Principle V requires automated tests for core domain logic;
the plan adds DB/RLS tests and end-to-end tests. Core tests are written first and must fail
before the matching implementation.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to (US1–US4)

## Path Conventions

Monorepo per plan.md: `packages/core/`, `apps/web/`, `supabase/`. Ref docs:
data-model = `specs/001-block-trip-planner/data-model.md`, core contract =
`specs/001-block-trip-planner/contracts/core.md`, DB contract =
`specs/001-block-trip-planner/contracts/database.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Workspace, tooling, and empty packages

- [X] T001 Create pnpm workspace: `package.json` (private, scripts `lint`, `test`, `test:db`), `pnpm-workspace.yaml` listing `packages/*` and `apps/*`, `tsconfig.base.json` (strict, ES2022, moduleResolution bundler), `.gitignore` additions (`node_modules`, `dist`, `.env.local`, `supabase/.temp`)
- [X] T002 [P] Scaffold `packages/core` as `@cellar/core`: `packages/core/package.json` (deps: `fractional-indexing`, `uuid`; devDeps: `vitest`), `packages/core/tsconfig.json` with `"lib": ["ES2022"]` and no DOM types, `packages/core/vitest.config.ts`, empty `packages/core/src/index.ts`
- [X] T003 [P] Scaffold `apps/web` with Vite React TS template: `apps/web/package.json` (deps: `react@19`, `react-dom@19`, `react-router`, `@supabase/supabase-js@2`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@cellar/core` workspace; devDeps: `vitest`, `@testing-library/react`, `jsdom`, `@playwright/test`), `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/.env.example` with `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`
- [X] T004 [P] Run `supabase init` to create `supabase/config.toml`; enable email confirmations and set `site_url` to `http://localhost:5173`
- [X] T005 [P] Configure ESLint + Prettier in `eslint.config.js` and `.prettierrc`; add an ESLint `no-restricted-imports` rule for `packages/core/**` banning `react`, `react-dom`, `@supabase/*` (constitution III)
- [X] T006 [P] Configure stylelint in `apps/web/.stylelintrc.json` with `stylelint-declaration-strict-value` requiring `var(--…)` for `color`, `background-color`, `border-color`, `border-radius`, `box-shadow`, `font-family`, `font-size`, `margin`, `padding`, `gap` (allowing `0` and `auto`), ignoring `apps/web/src/styles/tokens.css` (research R9, constitution II)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain types, database schema with RLS, auth, persistence, design tokens, app shell

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Core foundations

- [X] T007 [P] Define all domain types exactly as in the core contract (`ItemType`, `ISODate`, `Trip`, `Block`, `DaySetting`, `Item`, `Placement`, `TripState`) in `packages/core/src/model/types.ts`
- [X] T008 [P] Define `ValidationError` with codes `EMPTY_NAME`, `END_BEFORE_START`, `RANGE_TOO_LONG`, `LAST_BLOCK`, `ARRIVAL_AFTER_DEPARTURE`, `DATE_OUT_OF_RANGE`, `INVALID_LINK`, `NOT_FOUND` and a user-facing `message` in `packages/core/src/model/errors.ts`
- [X] T009 Write failing unit tests for validators in `packages/core/tests/validation.test.ts`: trip name "Required, 1–100 chars after trim"; block name "Required, 1–40 chars"; item/placement name "Required, 1–200 chars"; notes "≤ 5,000 chars"; link "Must be an http(s) URL if present"; dates "end_date ≥ start_date; max 60 days span"
- [X] T010 Implement validators to pass T009 in `packages/core/src/model/validation.ts`
- [X] T011 [P] Define `Change`, `Result`, and `Command` types (a command is `(state) => Result`, `Result` carries `state`, `changes`, `inverse`) in `packages/core/src/commands/command.ts`
- [X] T012 [P] Add `newId()` using the pure-JS `uuid` package (`v4`, no platform globals — must run on React Native) and `positionBetween(a, b)` wrapping `fractional-indexing`'s `generateKeyBetween` in `packages/core/src/model/ids.ts`
- [X] T013 [P] Define `TripRepository` and `AuthService` interfaces exactly as in the core contract in `packages/core/src/ports.ts`
- [X] T014 Export types, errors, validators, ports from `packages/core/src/index.ts`

### Database

- [X] T015 Create schema migration `supabase/migrations/0001_schema.sql`: enum `placement_type ('activity','food')`; tables `profiles` (incl. `deletion_requested_at timestamptz null`), `trips` (incl. `deleted_at timestamptz null`), `blocks`, `day_settings`, `items`, `placements` with columns, FKs and cascade rules from data-model.md (`day_settings.arrival_block_id`/`departure_block_id` "on delete set null"; `placements.source_item_id` "on delete set null"; `placements.block_id` cascade; all `trip_id` cascade; `trips.owner_id` → `auth.users` cascade); PK `(trip_id, date)` on `day_settings`; NO unique constraint on any `position` column (ties ordered by `id`); check `end_date >= start_date and end_date - start_date <= 59`; check non-empty trimmed names and length limits; index on `placements (trip_id, date, block_id)`
- [X] T016 Create triggers migration `supabase/migrations/0002_triggers.sql`: `updated_at = now()` before insert/update on all tables; create `profiles` row on `auth.users` insert; reject deleting a trip's last block; reject `placements`/`day_settings` `date` outside the trip's range; reject `block_id`, `source_item_id`, `arrival_block_id`, `departure_block_id` that belong to a different `trip_id`
- [X] T017 Create migration `supabase/migrations/0004_account_rpcs.sql`: RPCs `request_account_deletion()` (sets `profiles.deletion_requested_at = now()`) and `cancel_account_deletion() returns boolean` (clears it; true if a deletion was pending), both `security definer`, scoped to `auth.uid()`, execute granted to `authenticated` only (needed by sign-in in T025)
- [X] T018 Create RLS migration `supabase/migrations/0003_rls.sql` enabling RLS and the policies in contracts/database.md (profiles: `id = auth.uid()` select/update; trips: `owner_id = auth.uid()`; child tables: `exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid())`); add `trips`, `blocks`, `day_settings`, `items`, `placements` to the `supabase_realtime` publication
- [X] T019 [P] Create DB test harness `supabase/tests/vitest.config.ts` and `supabase/tests/helpers.ts` (create two confirmed test users via service-role client, return per-user anon clients; reset data between tests); wire root script `test:db`
- [X] T020 Write DB tests in `supabase/tests/rls.test.ts`: user B cannot select/insert/update/delete user A's trip or any child row; cross-trip `block_id` reference rejected; last-block delete rejected; out-of-range placement date rejected; 61-day trip rejected
- [X] T021 Write DB tests in `supabase/tests/account-rpcs.test.ts`: request sets the timestamp; cancel clears it and returns true, and returns false when nothing is pending; one user cannot affect another's profile

### Web foundations

- [X] T022 [P] Create design tokens in `apps/web/src/styles/tokens.css`: CSS custom properties for colors (surface, surface-raised, text, text-muted, border, accent, activity, food, greyed, danger), spacing scale (4/8/12/16/24/32 px), radii (`--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 16px, `--radius-pill` 999px), font family/sizes, shadows; dark values under `@media (prefers-color-scheme: dark)`; all text/background pairs ≥ 4.5:1 contrast
- [X] T023 [P] Create base styles in `apps/web/src/styles/global.css` (reset, body background/text from tokens, visible `:focus-visible` ring) and import both CSS files in `apps/web/src/main.tsx`
- [X] T024 [P] Create Supabase client from `import.meta.env` vars in `apps/web/src/lib/supabaseClient.ts` (anon key only)
- [X] T025 Implement `AuthService` with Supabase in `apps/web/src/adapters/supabaseAuthService.ts` (`signUp`, `signIn` which then calls RPC `cancel_account_deletion` and returns `{ deletionCancelled }`, `signOut`, `requestPasswordReset`, `updatePassword`, `requestAccountDeletion`, `currentUser`, `onAuthChange`)
- [X] T026 Implement the save outbox in `apps/web/src/adapters/outbox.ts`: queue of `Change[]` batches, sequential flush via `TripRepository.save`; classify failures — network errors, HTTP 5xx and 429 are transient (keep batch, exponential backoff 1 s → 30 s cap, retry on `online` event), other 4xx and Postgres constraint/RLS errors are permanent (drop batch, emit `discarded` event, continue with next batch); mirror queue to `localStorage` key `cellar.outbox` and restore on start; expose `status: 'saved' | 'saving' | 'retrying'`, `pendingKeys()` (row keys with unsaved changes), and a subscribe API (research R6)
- [X] T027 Write adapter tests for the outbox in `apps/web/tests/outbox.test.ts`: transient failure stays queued and status becomes `retrying`; permanent failure drops the batch, emits `discarded`, and later batches still save; queue survives reload via `localStorage`; batches flush in order after success; `pendingKeys()` clears once a row's save succeeds
- [X] T028 Implement `TripRepository` with Supabase in `apps/web/src/adapters/supabaseTripRepository.ts`: `listTrips` (excludes `deleted_at` set), `listDeletedTrips`, `loadTrip` (one query per table filtered by `trip_id`), `save(changes)` mapping each `Change` to upsert/delete on its table (camelCase ↔ snake_case), `deleteTrip` (sets `deleted_at = now()`), `restoreTrip` (clears it); leave `subscribe` returning a no-op until US1 (T042)
- [X] T029 Create app shell and routing in `apps/web/src/App.tsx`: routes `/signin`, `/signup`, `/reset-password`, `/` (trip list), `/trips/:tripId`, `/settings`; signed-out users (including on session expiry) are redirected to `/signin?returnTo=<current path>`; provide AuthService and TripRepository via React context in `apps/web/src/state/services.tsx`
- [X] T030 [P] Build shared UI primitives with CSS Modules using tokens only: `Button`, `TextField`, `Dialog` (focus-trapped, Esc closes), `ConfirmDialog`, `Banner` in `apps/web/src/components/ui/`
- [X] T031 Build auth pages `apps/web/src/pages/SignIn.tsx`, `SignUp.tsx`, `ResetPassword.tsx` (request email + set new password from the reset link); after sign-in navigate to `returnTo` if it is a same-origin path, else `/`; on sign-in with `deletionCancelled: true`, show "Your account deletion was cancelled"
- [X] T032 Build save-status banner `apps/web/src/components/SaveStatusBanner.tsx` bound to outbox status: shows "Not saved — retrying" while `retrying`, and "A change couldn't be saved and was undone" after a `discarded` event (FR-020)

**Checkpoint**: A user can sign up, sign in, reset a password; DB is secured and tested.

---

## Phase 3: User Story 1 - Create a trip with a day × block schedule (Priority: P1) 🎯 MVP

**Goal**: Create trips, see the day × block grid with default blocks, type events into cells,
and see changes sync across devices.

**Independent Test**: Create a 4-day trip, confirm 4 columns with the 10 default blocks, type an
event into a cell, press Enter and add a second, switch one to Food place, reload and confirm
both persist; open the trip in a second browser and see edits appear within 5 s.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T033 [P] [US1] Unit tests for trip commands in `packages/core/tests/trip.test.ts`: `createTrip` returns 10 blocks named Morning, Breakfast, Late morning, Lunch, Afternoon, Late afternoon, Dinner, Dessert, Evening, Night in that order; rejects empty name, end before start, span > 60 days; `renameTrip` validates; each returns correct `changes` and an `inverse` that restores the prior state
- [X] T034 [P] [US1] Unit tests for typed placements in `packages/core/tests/placement-typed.test.ts`: `addTypedPlacement` creates type `activity` with `sourceItemId: null`, appends after the given placement; `updatePlacement` changes name/type/notes/link of only that placement; `removePlacement`; `movePlacement` across cells and within a cell keeps correct order
- [X] T035 [P] [US1] Unit tests for queries in `packages/core/tests/queries.test.ts`: `days()` returns each date inclusive with weekday; `cell()` returns placements ordered by position, then `id` for equal positions
- [X] T036 [P] [US1] Unit tests for `applyRemote` in `packages/core/tests/merge.test.ts`: newer `updatedAt` wins, older is ignored; a DELETE carrying only the primary key removes the matching row (`id`, or `tripId`+`date` for day settings); delete of unknown key is ignored; upsert of new row is added; changes to rows in `pendingKeys` are ignored

### Implementation for User Story 1

- [X] T037 [US1] Implement `createTrip`, `renameTrip` in `packages/core/src/commands/trip.ts` (default blocks get positions from `positionBetween`)
- [X] T038 [US1] Implement `addTypedPlacement`, `updatePlacement`, `movePlacement`, `removePlacement` in `packages/core/src/commands/placement.ts`
- [X] T039 [P] [US1] Implement `days` and `cell` in `packages/core/src/queries/days.ts` and `packages/core/src/queries/cell.ts` (ordering: `position`, then `id`; use the same comparator for blocks)
- [X] T040 [P] [US1] Implement `applyRemote(state, change, pendingKeys)` in `packages/core/src/merge.ts`
- [X] T041 [US1] Export US1 commands/queries/merge from `packages/core/src/index.ts`
- [X] T042 [US1] Implement `subscribe(tripId, onChange)` in `apps/web/src/adapters/supabaseTripRepository.ts` using a Realtime channel: INSERT/UPDATE `postgres_changes` on `blocks`, `day_settings`, `items`, `placements` filtered by `trip_id=eq.{tripId}` and on `trips` filtered by `id=eq.{tripId}`; DELETE on the same tables with no filter (DELETE cannot be filtered and carries only the primary key under RLS); map payloads to `Change`
- [X] T043 [US1] Implement the trip store in `apps/web/src/state/tripStore.ts`: holds `TripState`, `dispatch(command)` applies the command, pushes `changes` to the outbox, and notifies; incoming remote changes go through `applyRemote` with the outbox's `pendingKeys()`; on an outbox `discarded` event, reload the trip from the repository; expose `useTrip(tripId)` hook in `apps/web/src/state/useTrip.ts` that loads, subscribes, and unsubscribes
- [X] T044 [P] [US1] Build trip list page `apps/web/src/pages/Trips.tsx`: list name + date range; create-trip dialog (name, start, end with validation messages from core); rename; delete (soft) followed by an "Undo" message for 10 s; collapsible "Recently deleted" section listing `listDeletedTrips()` with days remaining (30 − days since deleted) and a Restore button
- [X] T045 [US1] Build the grid `apps/web/src/components/grid/Grid.tsx` + `Grid.module.css`: sticky block-label column and sticky day header; columns from `days()` labeled with date + weekday; horizontal scroll for long trips; at < 640px width show one day at a time with prev/next day controls
- [X] T046 [US1] Build `apps/web/src/components/grid/Cell.tsx`: renders `cell()` placements; inline input to type an event; Enter creates the placement via `addTypedPlacement` and opens a new input in the same cell; Esc cancels; cell grows to fit content, no hidden placements
- [X] T047 [US1] Build `apps/web/src/components/grid/PlacementCard.tsx`: shows name with an icon + text label for Activity / Food place (not color alone); one-action type toggle; edit name/notes/link in a popover; remove button; all controls keyboard reachable with accessible names
- [X] T048 [US1] Build trip planner page `apps/web/src/pages/TripPlanner.tsx` wiring `useTrip`, `Grid`, and `SaveStatusBanner`; show "Trip not found" when load returns nothing (covers another user's trip id, FR-018)
- [X] T049 [US1] Add component tests in `apps/web/tests/Cell.test.tsx`: typing + Enter creates two placements in order; type toggle switches icon and label

**Checkpoint**: MVP — trips, grid, typed events, persistence, and cross-device sync work.

---

## Phase 4: User Story 2 - Build an activity & food list and place items into blocks (Priority: P1)

**Goal**: Per-trip list of activities and food places; drag items into cells as independent
copies; suggestions while typing in a cell.

**Independent Test**: Add 3 activities and 2 food places; drag one food place into two
breakfasts; edit one copy's notes and confirm the other copy and list item are unchanged; drag
a placement between cells; delete the list item and confirm copies remain; type "ichi" in a
cell and pick the suggestion.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T050 [P] [US2] Unit tests for item commands in `packages/core/tests/item.test.ts`: `addItem` requires name "1–200 chars" and type `activity` | `food`; `updateItem` / `deleteItem` never change placements (FR-009)
- [X] T051 [P] [US2] Unit tests for `placeItem` in `packages/core/tests/placement-from-item.test.ts`: copies name/type/notes/link and sets `sourceItemId`; item stays in list; same item can be placed in several cells; inserts before the given placement
- [X] T052 [P] [US2] Unit tests for list queries in `packages/core/tests/item-queries.test.ts`: `placedCount`; `filterItems` by type and by placed / not placed; `suggestItems` is case- and accent-insensitive, ranks prefix matches above contains matches, honors `limit` (default 5), returns `[]` for empty query

### Implementation for User Story 2

- [X] T053 [US2] Implement `addItem`, `updateItem`, `deleteItem` in `packages/core/src/commands/item.ts`
- [X] T054 [US2] Implement `placeItem` in `packages/core/src/commands/placement.ts`
- [X] T055 [US2] Implement `placedCount`, `filterItems`, `suggestItems` in `packages/core/src/queries/items.ts` and export them plus item commands from `packages/core/src/index.ts`
- [X] T056 [US2] Build list panel `apps/web/src/components/list/ItemList.tsx` + `ItemList.module.css`: add/edit/delete items (name, type, notes, link); filter chips All / Activities / Food / Not yet placed; each row shows icon + label and "placed N×"; on desktop a side panel, at < 640px a bottom sheet
- [X] T057 [US2] Add drag-and-drop in `apps/web/src/components/grid/DndProvider.tsx` with `@dnd-kit/core` + `@dnd-kit/sortable` (pointer, touch, and keyboard sensors; screen-reader announcements): list item → cell dispatches `placeItem`; placement → other cell or position dispatches `movePlacement`; wire into `TripPlanner.tsx`, `ItemList.tsx`, `Cell.tsx`, `PlacementCard.tsx`
- [X] T058 [US2] Add suggestions to the cell input in `apps/web/src/components/grid/CellSuggestions.tsx`: show `suggestItems` results under the input as an accessible listbox (arrow keys + Enter); choosing one dispatches `placeItem`; otherwise Enter creates a typed Activity (FR-007a)
- [X] T059 [US2] Add component tests in `apps/web/tests/CellSuggestions.test.tsx`: "ichi" suggests "Ichiran Ramen"; choosing it creates a Food placement with `sourceItemId` set; ignoring creates a typed Activity

**Checkpoint**: US1 + US2 together cover the full Google Sheets replacement workflow.

---

## Phase 5: User Story 3 - Customize time blocks (Priority: P2)

**Goal**: Add, rename, reorder, remove blocks; set per-day arrival/departure that greys out
blocks outside the window.

**Independent Test**: Add "Tea" after Afternoon, rename Late morning, move Evening
above Dinner, remove an empty block; set Day 1 arrival = Lunch and last-day departure =
Afternoon and confirm the right cells are greyed but still accept drops.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T060 [P] [US3] Unit tests for block commands in `packages/core/tests/block.test.ts`: `addBlock(name, afterBlockId)` positions correctly; name "Required, 1–40 chars; duplicates allowed"; `moveBlock`; `removeBlock` deletes its placements, clears any DaySetting arrival/departure that referenced it, rejects removing the last block (`LAST_BLOCK`); `impactOfRemoveBlock` returns counts
- [X] T061 [P] [US3] Unit tests for day window in `packages/core/tests/day-window.test.ts`: `setDayWindow` rejects arrival after departure (`ARRIVAL_AFTER_DEPARTURE`) and dates outside the trip; clearing both removes the DaySetting; `isGreyed` is true only for blocks before arrival or after departure on that day

### Implementation for User Story 3

- [X] T062 [US3] Implement `addBlock`, `renameBlock`, `moveBlock`, `removeBlock`, `impactOfRemoveBlock` in `packages/core/src/commands/block.ts`
- [X] T063 [US3] Implement `setDayWindow` in `packages/core/src/commands/daySetting.ts` and `isGreyed` in `packages/core/src/queries/greyed.ts`; export from `packages/core/src/index.ts`
- [X] T064 [US3] Build block editor `apps/web/src/components/grid/BlockLabel.tsx`: inline rename, "add block below", drag/keyboard reorder via dnd-kit sortable, remove with `ConfirmDialog` stating how many placements will be removed and which days lose arrival/departure
- [X] T065 [US3] Build day header menu `apps/web/src/components/grid/DayHeader.tsx`: set/clear arrival block and departure block; show validation message from core; when set, show visibly in the header an icon plus "Arrive · {block}" / "Depart · {block}"
- [X] T066 [US3] Apply greyed style in `apps/web/src/components/grid/Cell.tsx` using `isGreyed`: token `--color-greyed` background, dimmed placements, AND a visible small "outside travel window" icon with an accessible name (not dimming alone, constitution II); cells still accept typing and drops

**Checkpoint**: Blocks are fully customizable; travel days display correctly.

---

## Phase 6: User Story 4 - Undo and adjust trip dates (Priority: P2)

**Goal**: Undo/redo every planning action; change trip dates with a warning when placements
would be lost.

**Independent Test**: Move a placement, delete a block, undo twice → original state; redo once
→ move reapplied. Shorten a trip with placements on the last day → warning with count; cancel
keeps everything.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T067 [P] [US4] Unit tests for `History` in `packages/core/tests/history.test.ts`: for every command in contracts/core.md, apply → undo restores a deep-equal prior state, redo re-applies; a new command after undo clears the redo stack; `undo()` returns the `changes` to persist
- [X] T068 [P] [US4] Unit tests for `updateTripDates` in `packages/core/tests/trip-dates.test.ts`: shrinking returns `removedPlacementCount` and removes placements and DaySettings outside the range; extending changes no rows; validates range

### Implementation for User Story 4

- [X] T069 [US4] Implement `History` in `packages/core/src/history.ts` and export it
- [X] T070 [US4] Implement `updateTripDates` in `packages/core/src/commands/trip.ts`
- [X] T071 [US4] Route all planner dispatches through `History` in `apps/web/src/state/tripStore.ts` (clear history when switching trips); add Undo/Redo buttons to `apps/web/src/pages/TripPlanner.tsx` and shortcuts Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (ignored while typing in an input)
- [X] T072 [US4] Add edit-dates to the trip settings dialog in `apps/web/src/pages/TripPlanner.tsx`: on shrink, show `ConfirmDialog` "N placements on removed days will be deleted" before dispatching

**Checkpoint**: All four user stories work independently.

---

## Phase 7: Deletion purge & account settings (FR-002, FR-018a)

**Purpose**: 30-day purge of deleted trips and accounts, and the account settings page

- [X] T073 Create migration `supabase/migrations/0005_purge_job.sql`: SQL function `purge_expired_deletions()` that deletes `trips` where `deleted_at < now() - interval '30 days'` and `auth.users` whose `profiles.deletion_requested_at < now() - interval '30 days'`; enable `pg_cron` and schedule it daily
- [X] T074 Write DB tests in `supabase/tests/purge.test.ts`: a trip deleted 31 days ago is purged with all child rows, one deleted 29 days ago is kept; a 31-day account deletion request removes the user and all trips, a 29-day one is kept
- [X] T075 Build settings page `apps/web/src/pages/Settings.tsx`: email display, sign out, "Delete account" with `ConfirmDialog` explaining the 30-day grace period; on confirm call `requestAccountDeletion` then sign out

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T076 [P] Playwright config `apps/web/playwright.config.ts` (desktop Chrome + 360×740 mobile viewport, starts dev server against local Supabase) and e2e tests in `apps/web/e2e/planner.spec.ts` for quickstart scenarios 1–11
- [X] T077 [P] E2E sync test in `apps/web/e2e/sync.spec.ts`: two browser contexts on the same account; an edit in one appears in the other within 5 s (SC-007); offline edit shows "Not saved — retrying" and saves on reconnect (FR-020)
- [X] T078 [P] E2E keyboard-only + 360px test in `apps/web/e2e/a11y.spec.ts` covering create trip, add item, place item, edit block (SC-006), plus `@axe-core/playwright` scan of sign-in, trips, planner pages with zero serious/critical violations
- [X] T079 Performance check: seed a 60-day × 10-block × 300-placement trip in `apps/web/e2e/perf.spec.ts` and assert a typed placement appears within 100 ms of Enter
- [X] T080 Add root `README.md` with project summary and a link to `specs/001-block-trip-planner/quickstart.md`
- [ ] T081 Run all quickstart.md checks (`pnpm lint`, core tests, `pnpm test:db`, web tests, e2e) and manual scenarios 12–17; fix failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup — blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after Foundational; UI tasks T056–T058 build on `Cell.tsx`/`PlacementCard.tsx`/`TripPlanner.tsx` from US1, so do US1 first when working alone
- **US3 (Phase 5)**: after Foundational; UI tasks extend the US1 grid
- **US4 (Phase 6)**: core tasks after Foundational; T067 covers every command, so finish it after US1–US3 core commands exist
- **Deletion purge & account settings (Phase 7)**: after Foundational
- **Polish (Phase 8)**: after all desired stories

### Within Each Story

- Core tests (fail first) → core implementation → web adapters/state → UI → component tests

### Parallel Opportunities

- Setup: T002–T006
- Foundational: T007, T008, T011, T012, T013 together; T019, T022, T023, T024, T030 together
- Each story's core test tasks are [P]
- Core work for US2, US3, US4 can proceed in parallel with US1 UI work (different files)
- Phase 7 can run alongside any story
- Polish: T076–T078

---

## Parallel Example: User Story 1

```bash
# Core tests together:
Task: "Unit tests for trip commands in packages/core/tests/trip.test.ts"
Task: "Unit tests for typed placements in packages/core/tests/placement-typed.test.ts"
Task: "Unit tests for queries in packages/core/tests/queries.test.ts"
Task: "Unit tests for applyRemote in packages/core/tests/merge.test.ts"

# Then independent implementations:
Task: "Implement days and cell in packages/core/src/queries/"
Task: "Implement applyRemote in packages/core/src/merge.ts"
Task: "Build trip list page apps/web/src/pages/Trips.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 (US1) → **stop and validate** with its Independent Test
3. Usable: trips + grid + typed events + sync

### Incremental Delivery

1. + US2 → list, drag-and-drop, suggestions (replaces the Google Sheets workflow)
2. + US3 → custom blocks, arrival/departure
3. + US4 → undo/redo, date changes
4. + Account deletion → Polish → release

---

## Notes

- [P] = different files, no dependency on unfinished tasks
- Core code must not import React, DOM, or Supabase (enforced by T005)
- All styles use tokens from `tokens.css` (enforced by T006)
- Commit after each task or logical group
