---

description: "Task list for Popular Places Tab"
---

# Tasks: Popular Places Tab

**Input**: Design documents from `/specs/006-popular-places/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/core.md,
contracts/places-function.md, quickstart.md

**Tests**: Included. Constitution Principle V requires automated tests for core logic; research
R10 lists the core, handler, web and e2e tests. Tests are written first and must fail before the
matching implementation.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to (US1–US3)

## Path Conventions

Monorepo: `packages/core/`, `apps/web/`, `supabase/`. Ref docs (under
`specs/006-popular-places/`): research = `research.md`, data-model = `data-model.md`, core
contract = `contracts/core.md`, function contract = `contracts/places-function.md`. Feature 004
code this builds on: `PlaceSearch`, `Place`, `placeFields`, `isFoodPlace`, `OpenInMapsItems`,
`PlaceNameField`, `usePlaceSuggestions`, `supabase/functions/places/handler.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fixtures and mocks used by every story

- [X] T001 [P] Add e2e fixtures in `apps/web/e2e/fixtures/`: `places-popular-todo.json` and `places-popular-food.json` (`{"places":[...]}` per contracts/places-function.md, 3 places each; todo: "The Metropolitan Museum of Art" placeId "test-met", kind "Art museum", types `["art_museum","museum","tourist_attraction"]`, rating 4.8, ratingCount 104512, plus "Central Park" and "Empire State Building"; food: "Katz's Delicatessen" placeId "test-katz", kind "Deli", types `["deli","restaurant","food"]`, rating 4.5, ratingCount 40211, plus "Joe's Pizza" and "Los Tacos No. 1" placeId "test-tacos")
- [X] T002 Extend `mockPlaces(page, mode)` in `apps/web/e2e/helpers.ts`: `popular` requests return the todo or food fixture by `group` (or 503 `{"error":"unavailable"}` in `fail` mode); requests are recorded like the others
- [X] T003 [P] Extend `fakePlaceSearch` in `apps/web/tests/setup.ts` with a configurable `popular(city)` (default: resolves a `PopularList` with two todo and two food places; option to reject)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, port, relay action and adapter that all stories need

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add `PopularPlace` and `PopularList` to `packages/core/src/model/types.ts` exactly as in contracts/core.md, and `popular(city: Location): Promise<PopularList>` to `PlaceSearch` in `packages/core/src/ports.ts`; update every `PlaceSearch` implementation and fake so the build passes
- [X] T005 [P] Write failing tests in `packages/core/tests/popular.test.ts`: `popularToPlace(p)` returns `{ id: p.placeId, provider: 'google', name, address, lat, lon, category: p.types[0] ?? null }` and passes `validatePlace`; `category` is `null` for empty `types`
- [X] T006 Implement `popularToPlace` in new `packages/core/src/places/popular.ts`; export it and the new types from `packages/core/src/index.ts`; make T005 pass
- [X] T007 [P] Write failing tests in `supabase/tests/places-handler.test.ts` for the `popular` action (mocked fetch): POSTs `https://places.googleapis.com/v1/places:searchText` with `X-Goog-Api-Key`, `X-Goog-FieldMask` exactly `places.id,places.displayName,places.shortFormattedAddress,places.location,places.types,places.primaryType,places.primaryTypeDisplayName,places.rating,places.userRatingCount`, body `{ textQuery: 'top tourist attractions in New York, USA', locationBias: { circle: { center: { latitude, longitude }, radius: 15000 } }, pageSize: 20, rankPreference: 'RELEVANCE' }` for `group: 'todo'` and `'best restaurants in <city>'` for `'food'`; maps to `{ places: [{ placeId, name: displayName.text, kind: primaryTypeDisplayName.text ?? '', address: shortFormattedAddress ?? '', lat, lon, types, rating ?? null, ratingCount: userRatingCount ?? null }] }`, drops places missing id/displayName/location, caps at 20; 400 `bad_request` when `city` is empty or over 120 chars, `near` missing/invalid, or `group` not `todo`/`food`; 503 `unavailable` on Google non-2xx, fetch failure or missing key
- [X] T008 Implement the `popular` action in `supabase/functions/places/handler.ts` per contracts/places-function.md (reuse the existing CORS, timeout and error helpers); make T007 pass
- [X] T009 [P] Write failing tests in `apps/web/tests/supabasePlaceSearch.test.ts`: `popular(city)` invokes `places` twice (`group` todo and food) with `{ action: 'popular', city: city.name, near: { lat, lon }, group }`; returns `{ city, todo, food, fetchedAt }`; a place present in both groups is kept once — in `food` if `isFoodPlace(types)`, else in `todo`; rejects if either call errors
- [X] T010 Implement `popular` in `apps/web/src/adapters/supabasePlaceSearch.ts`; make T009 pass

**Checkpoint**: Popular data can be fetched end to end through the port

---

## Phase 3: User Story 1 - Browse popular places and drag them in (Priority: P1) 🎯 MVP

**Goal**: A Popular tab with things to do and food for the trip's city; cards drag (or use a menu) onto the schedule, creating linked events without touching the list.

**Independent Test**: Quickstart 1–6 and 10–13.

### Tests for User Story 1

- [X] T011 [P] [US1] Write failing tests in `packages/core/tests/popular-commands.test.ts`: `placePlace(place, 'food', date, blockId, beforeId?)` creates one placement with the place's name, all `PlaceFields` set, the given type, `sourceItemId: null`, positioned before `beforeId` (or last); does not change `items`; rejects an invalid cell or invalid place; one undo step removes it
- [X] T012 [P] [US1] Extend `packages/core/tests/location.test.ts`: `tripCities(state)` returns `[]` with no location; `[trip]` with only a trip location; trip first then distinct day overrides in date order, with duplicates (same `locationKey`) and overrides equal to the trip removed
- [X] T013 [P] [US1] Write failing tests in `apps/web/tests/usePopularPlaces.test.tsx` (fake `PlaceSearch`): `status: 'idle'` and no call when `city` is null; `loading` then `ready` with the list; a second render for the same city (or after unmount/remount within the same provider) makes no new call; switching city calls again; a rejection gives `status: 'unavailable'`
- [X] T014 [P] [US1] Write failing tests in `apps/web/tests/PopularTab.test.tsx`: tabs "My list" / "Popular" with `role="tab"` and `aria-selected`; Popular shows "Things to do" and "Food" headings, each card with name, kind, address and "4.8 (104,512 reviews)"; "Popular on Google · HH:MM" label; no location → "Set where this trip is to see popular places" with a button that opens the trip location dialog; failure → "Popular places unavailable right now"; empty groups → "No popular places found"; a city selector appears only for more than one city and switching it requests the new city; card menu has "Place in a block", "Add to my list", "Open in maps"; "Add to my list" dispatches `addItem` with the place and type (Food for food group)

### Implementation for User Story 1

- [X] T015 [US1] Implement `placePlace` in `packages/core/src/commands/placement.ts` (validate with `validateCell` and `validatePlace`, store via `placeFields`) and `tripCities` in `packages/core/src/queries/location.ts`; export both; make T011–T012 pass
- [X] T016 [US1] Implement `apps/web/src/state/usePopularPlaces.ts`: `(city: Location | null) => { list, status: 'idle' | 'loading' | 'ready' | 'unavailable' }`, with a module-level in-memory `Map` keyed by `locationKey(city)` (never `localStorage`), ignoring stale responses; make T013 pass
- [X] T017 [US1] Add the `popular:` prefix to `apps/web/src/components/grid/dndIds.ts`; implement `apps/web/src/components/list/PopularCard.tsx` (+ `.module.css`, tokens only): `useDraggable` with id `popular:<placeId>` and `data: { place: PopularPlace, type }`, type icon, name, kind · address, rating line with a star icon and text, and a `Menu` with "Place in a block" (opens `CellPickerDialog`, then dispatches `placePlace`), "Add to my list" (`addItem(name, type, null, null, popularToPlace(p))`) and `OpenInMapsItems`
- [X] T018 [US1] Implement `apps/web/src/components/list/PopularTab.tsx` (+ css): city selector from `tripCities(state)` (hidden for ≤ 1 city), the two groups, empty/no-location/unavailable/loading states, and the "Popular on Google · HH:MM" label from `fetchedAt`
- [X] T019 [US1] Add tabs to `apps/web/src/components/list/ItemPanel.tsx` (ARIA tabs pattern: `role="tablist"`, arrow-key switching, `role="tabpanel"`): "My list" (existing content) and "Popular" (`PopularTab`); remember the selected tab per device via the `KeyValueStore` key `cellar.panelTab`; make T014 pass
- [X] T020 [US1] Handle `popular:` drops in `apps/web/src/components/grid/DndProvider.tsx` (dispatch `placePlace(popularToPlace(data.place), data.type, date, blockId, beforeId)`, with an accessible announcement like the item case) and show a popular preview in `apps/web/src/components/grid/DragLayer.tsx` (name, type, pin)
- [X] T021 [US1] Write e2e `apps/web/e2e/popular.spec.ts` US1 tests with `mockPlaces`: quickstart 1–6 and 10–13; assert the recorded `popular` bodies contain only `action`, `city`, `near`, `group` (FR-012), and that switching tabs back does not repeat requests for a loaded city

**Checkpoint**: Popular places can be browsed and put on the schedule

---

## Phase 4: User Story 2 - Placed cards are struck through (Priority: P1)

**Goal**: Placed cards in both tabs show a strikethrough (plus hidden "placed" text) instead of a count, and stay draggable.

**Independent Test**: Quickstart 2, 3 and 7.

### Tests for User Story 2

- [X] T022 [P] [US2] Write failing tests in `packages/core/tests/placed.test.ts`: `isItemPlaced` false with no events, true after `placeItem`, false again after removing its events; `isPlacePlaced(state, placeId)` true when any item or any placement has that `placeId`, false otherwise
- [X] T023 [P] [US2] Extend `apps/web/tests/ItemPanel.test.tsx` and `apps/web/tests/PopularTab.test.tsx`: placed cards have the strikethrough class and an accessible name ending in ", placed"; no "placed N×" text anywhere; struck-through cards keep their drag handle and menu

### Implementation for User Story 2

- [X] T024 [US2] Implement `isItemPlaced` and `isPlacePlaced` in new `packages/core/src/queries/placed.ts`; export them; make T022 pass
- [X] T025 [US2] In `ItemPanel.tsx` replace the `placed {count}×` span with a `.placed` class on the name (`text-decoration: line-through` and muted color via tokens) plus a visually hidden ", placed"; apply the same to `PopularCard.tsx` using `isPlacePlaced`; make T023 pass
- [X] T026 [US2] Add US2 e2e tests to `apps/web/e2e/popular.spec.ts`: quickstart 2, 3 and 7 (strikethrough appears, re-drag works, strikethrough clears when all events are removed)

**Checkpoint**: US1 + US2 deliver the full P1 value

---

## Phase 5: User Story 3 - Quick-add line replaces search (Priority: P2)

**Goal**: The list's top line adds items on Enter, offers place suggestions, and narrows the list as you type.

**Independent Test**: Quickstart 8–9.

### Tests for User Story 3

- [X] T027 [P] [US3] Extend `packages/core/tests/item-queries.test.ts`: `matchesItemName(item, text)` is case- and accent-insensitive ("cafe" matches "Café"), substring-based, and true for empty or whitespace text
- [X] T028 [P] [US3] Write failing tests in `apps/web/tests/QuickAddLine.test.tsx` (fake `PlaceSearch`): labelled "Add or filter items", placeholder "Add an item…"; typing calls `onFilter(text)`; Enter with no active suggestion dispatches `addItem(text.trim(), 'activity')`, clears the line, calls `onFilter('')` and keeps focus; Enter on empty/whitespace does nothing; picking a suggestion adds a linked item (Food for food places); Escape closes suggestions and keeps the text

### Implementation for User Story 3

- [X] T029 [US3] Add `matchesItemName` to `packages/core/src/queries/items.ts` (reuse the folding from `suggestItems`); export it; make T027 pass
- [X] T030 [US3] Implement `apps/web/src/components/list/QuickAddLine.tsx` (+ css) on top of `usePlaceSuggestions` and the `PlaceOptions`/`PlaceNotes` components from feature 004, with `near = suggestNear(state)`; make T028 pass
- [X] T031 [US3] Replace the search input in `ItemPanel.tsx` with `QuickAddLine`, filtering the shown items with `matchesItemName` combined with the existing type/placed filters; remove the local `fold` helper and the "Search items" input; update `ItemPanel.test.tsx` and any e2e that used "Search items"
- [X] T032 [US3] Add US3 e2e tests to `apps/web/e2e/popular.spec.ts` (or `places.spec.ts`): quickstart 8–9

**Checkpoint**: All three stories work independently

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T033 [P] Add the Popular tab (results, unavailable state, open card menu) and the quick-add suggestions to the axe checks in `apps/web/e2e/a11y.spec.ts` in light and dark, and a 360 px check in `apps/web/e2e/layout.spec.ts` that the tabs and cards fit without horizontal scroll (quickstart 14)
- [ ] T034 [P] Document in `README.md`: the Popular tab uses Google Text Search (Enterprise tier, 1,000 free requests/month), recommended daily quota cap (~100/day on Text Search), and that results are kept in memory for the session only (Google terms)
- [ ] T035 Make sure e2e specs that render the item panel mock `places` (`mockPlaces(page, 'fail')` at least) so no test can reach Google through the Popular tab
- [ ] T036 Run `pnpm lint`, `pnpm --filter web typecheck`, `pnpm test`, `pnpm test:db` and `pnpm --filter web e2e`; fix failures
- [ ] T037 Walk through quickstart.md manual scenarios 1–14 with the real key (or record which ones need the user)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup; blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after Foundational for the list part; the Popular strikethrough needs `PopularCard` from US1
- **US3 (Phase 5)**: after Foundational; independent of US1/US2 (touches the list tab only)
- **Polish (Phase 6)**: after the stories you ship

### Within Each Story

Tests first (must fail) → core → hooks/components → integration → e2e.

### Parallel Opportunities

- Phase 1: T001, T003
- Phase 2: T005 with T007 and T009 (after T004)
- US1: T011–T014 together
- US2: T022, T023
- US3: T027, T028
- Polish: T033, T034

## Parallel Example: User Story 1

```text
Task: "T011 placePlace tests in packages/core/tests/popular-commands.test.ts"
Task: "T012 tripCities tests in packages/core/tests/location.test.ts"
Task: "T013 usePopularPlaces tests in apps/web/tests/usePopularPlaces.test.tsx"
Task: "T014 PopularTab tests in apps/web/tests/PopularTab.test.tsx"
```

## Implementation Strategy

### MVP First

1. Phases 1–2 → popular data through the port
2. Phase 3 (US1) → validate quickstart 1–6, 10–13
3. Phase 4 (US2) right after; together they are the P1 value

### Incremental Delivery

US1 → US2 → US3, each a working increment; Polish last. Merge to `main` only after the user
confirms the feature is finished.
