---

description: "Task list for Map Locations for Items"
---

# Tasks: Map Locations for Items

**Input**: Design documents from `/specs/004-map-locations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/core.md,
contracts/database.md, contracts/places-function.md, quickstart.md

**Tests**: Included. Constitution Principle V requires automated tests for core domain logic;
research R9 lists the core, edge handler, DB and e2e tests. Tests are written first and must
fail before the matching implementation.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to (US1–US3)

## Path Conventions

Monorepo per plan.md: `packages/core/`, `apps/web/`, `supabase/`. Ref docs (all under
`specs/004-map-locations/`): research = `research.md`, data-model = `data-model.md`, core
contract = `contracts/core.md`, DB contract = `contracts/database.md`, function contract =
`contracts/places-function.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Folders and test fixtures used by every story

- [X] T001 Create folders `packages/core/src/places/`, `apps/web/src/components/places/` and `supabase/functions/places/`; add `supabase/functions/.env` to `.gitignore` and a committed `supabase/functions/.env.example` containing `GOOGLE_PLACES_API_KEY=`
- [X] T002 [P] Add e2e fixtures in `apps/web/e2e/fixtures/`: `places-suggest-chelsea.json` (`{"suggestions":[...]}` per the function contract with Chelsea Market — placeId "test-chelsea", address "9th Avenue, New York, NY, USA", types `["market","point_of_interest"]` — plus "Chelsea Piers" and "Chelsea Hotel"), `places-suggest-tacos.json` (Los Tacos No. 1, placeId "test-tacos", types `["mexican_restaurant","restaurant","food"]`), `places-suggest-empty.json` (`{"suggestions":[]}`), `places-details-chelsea.json` (`{"place":{"id":"test-chelsea","lat":40.7424,"lon":-74.0061,"address":"75 9th Ave, New York"}}`) and `places-details-tacos.json` (lat 40.7441, lon -74.0063, "75 9th Ave, New York")
- [X] T003 [P] Add `mockPlaces(page, mode: 'ok' | 'fail')` to `apps/web/e2e/helpers.ts` (next to `mockOpenMeteo`): routes `**/functions/v1/places` POSTs by body `action` — `suggest` returns the tacos fixture when `input` contains "taco", the empty fixture when it contains "zzzxqq", else the chelsea fixture; `details` returns the details fixture matching `placeId`; `fail` returns HTTP 503 `{"error":"unavailable"}` for every call. Also record each request body on an array the test can read, to assert what was sent

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, types, port, Edge Function, web adapter and service wiring that all stories need

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `supabase/migrations/0007_places.sql` exactly per contracts/database.md for both `items` and `placements`: columns `place_id text null`, `place_provider text null`, `place_name text null`, `place_address text null`, `place_lat double precision null`, `place_lon double precision null`, `place_category text null`; constraints `<table>_place_all_or_none` ("all seven null, or the first six all non-null; `place_category` may be null on a linked row") and `<table>_place_check` ("`char_length(place_id) between 1 and 300`; `place_provider = 'google'`; `char_length(btrim(place_name)) between 1 and 200`; `char_length(place_address) <= 300`; lat in [−90, 90]; lon in [−180, 180]; `place_category` null or ≤ 100 chars"). No backfill; RLS unchanged
- [X] T005 [P] Write DB tests in `supabase/tests/place-columns.test.ts` (style of `supabase/tests/weather-columns.test.ts`, helpers from `supabase/tests/helpers.ts`), for both `items` and `placements`: row with only `place_id` set rejected; lat 91 / lon −181 rejected; `place_provider` "apple" rejected; `place_name` of 201 chars rejected; plain row accepted; fully linked row with `place_category` null accepted; another user cannot read the new columns (RLS unchanged)
- [X] T006 Extend `packages/core/src/model/types.ts` per contracts/core.md: `PlaceProvider`, `PlaceFields` (seven fields, all `| null`) mixed into `Item` and `Placement`; new types `Place`, `PlaceSuggestion`, `MapApp`
- [X] T007 Add `validatePlace(place: Place | null)` to `packages/core/src/model/validation.ts` and error code `INVALID_PLACE` in `packages/core/src/model/errors.ts`. Rules (data-model.md): "`id` 1–300 chars; `provider` `'google'`; `name` 1–200 chars, trimmed; `address` 0–300 chars; `lat` −90…90; `lon` −180…180; `category` null or ≤ 100 chars". `null` is valid (plain)
- [X] T008 [P] Write failing tests in `packages/core/tests/places-fields.test.ts`: `placeFields(place)` maps every Place field to its flat field; `placeFields(null)` returns all seven fields `null`; `placeOf(placeFields(p))` round-trips; `placeOf` of a plain row returns `null`; `validatePlace` accepts a valid place and `null`, and returns `INVALID_PLACE` for empty name, 201-char name, lat 100, lon 200, provider "apple"
- [X] T009 Implement `placeFields` and `placeOf` in `packages/core/src/places/fields.ts` and `validatePlace` (T007); make T008 pass
- [X] T010 Update `packages/core/tests/fixtures.ts` and every place in `packages/core/src` that builds an `Item` or `Placement` literal (`commands/item.ts` `addItem`, `commands/placement.ts` `addTypedPlacement` and `placeItem`) to spread `placeFields(null)` so the build passes without changing behavior yet; run `pnpm --filter @cellar/core test` and confirm all existing tests pass
- [X] T011 Add the `PlaceSearch` interface to `packages/core/src/ports.ts` exactly as in contracts/core.md "Port"
- [X] T012 Export the new types, `PlaceSearch`, `placeFields`, `placeOf` and `validatePlace` from `packages/core/src/index.ts`
- [X] T013 [P] Write failing tests in `supabase/tests/places-handler.test.ts` for `handlePlaces(req: Request, env: { key?: string }, fetchFn: typeof fetch): Promise<Response>` with a mocked `fetchFn`: `suggest` posts to `https://places.googleapis.com/v1/places:autocomplete` with header `X-Goog-Api-Key`, body `{ input, sessionToken, locationBias: { circle: { center: { latitude, longitude }, radius: 30000 } } }` (no `locationBias` when `near` is absent) and nothing else from the request; maps `suggestions[].placePrediction` to `{ placeId, name: structuredFormat.mainText.text, address: structuredFormat.secondaryText.text ?? '', types }`, drops query predictions, caps at 5; `details` GETs `https://places.googleapis.com/v1/places/<placeId>?sessionToken=<token>` with `X-Goog-FieldMask: id,location,shortFormattedAddress` and returns `{ place: { id, lat, lon, address } }`; `input` shorter than 3 or longer than 100 chars, unknown `action`, or non-JSON body → 400 `{"error":"bad_request"}`; no key, Google non-2xx, or fetch rejection/timeout → 503 `{"error":"unavailable"}`; `OPTIONS` → 204 with CORS headers. These tests don't need the database
- [X] T014 Implement `supabase/functions/places/handler.ts` (only `fetch`, `Request`, `Response`, `AbortSignal.timeout(5000)`; no Deno APIs) per contracts/places-function.md; make T013 pass
- [X] T015 Create `supabase/functions/places/index.ts`: `Deno.serve((req) => handlePlaces(req, { key: Deno.env.get('GOOGLE_PLACES_API_KEY') }, fetch))`; add `[functions.places]` with `verify_jwt = true` to `supabase/config.toml`; add `supabase/functions/**/index.ts` to the ESLint ignores in `eslint.config.js` only if `Deno` globals fail lint (prefer adding `Deno` to that file's globals)
- [X] T016 [P] Write failing tests in `apps/web/tests/supabasePlaceSearch.test.ts` with a mocked Supabase client: `suggest('chel', { sessionToken, near })` invokes function `places` with body `{ action: 'suggest', input: 'chel', sessionToken, near }` and returns its `suggestions`; `details(suggestion, token)` invokes `{ action: 'details', placeId, sessionToken }` and returns a `Place` with `provider: 'google'`, `name: suggestion.name`, `category: suggestion.types[0] ?? null` plus the function's `id`, `lat`, `lon`, `address`; both reject when the invoke returns an error
- [X] T017 Implement `apps/web/src/adapters/supabasePlaceSearch.ts` (`SupabasePlaceSearch implements PlaceSearch`, using `client.functions.invoke('places', { body })`); make T016 pass
- [X] T018 Wire services: add `places: PlaceSearch` to `Services` in `apps/web/src/state/services.tsx`, construct `SupabasePlaceSearch` in `apps/web/src/main.tsx`, and add a fake `PlaceSearch` (returns `[]`, configurable per test) to the test services in `apps/web/tests/setup.ts`

**Checkpoint**: Schema, core types, port, function and adapter ready — user stories can begin

---

## Phase 3: User Story 1 - Get a place suggestion while typing an item (Priority: P1) 🎯 MVP

**Goal**: While typing an item name (item panel add form, grid cell quick-add), a live list of up to 5 places appears; picking one links the item, shows its address and a pin, and sets Food for food places. Ignoring it saves plain text.

**Independent Test**: Quickstart scenarios 1–5 and 11: type "Chelsea Mar" in the item panel, pick Chelsea Market, save → linked item with address; "Rest day" + Enter → plain item; with the function failing → "Place search unavailable" and plain saving works.

### Tests for User Story 1

- [X] T019 [P] [US1] Write failing tests in `packages/core/tests/places-food.test.ts`: `isFoodPlace` true for `restaurant`, `cafe`, `coffee_shop`, `bar`, `bakery`, `meal_takeaway`, `meal_delivery`, `food_court`, `ice_cream_shop`, `dessert_shop`, `food`, `ramen_restaurant`; false for `["market","point_of_interest"]`, `["museum"]`, `[]`
- [X] T020 [P] [US1] Extend `packages/core/tests/item.test.ts`: `addItem(name, type, null, null, place)` stores all place fields; invalid place returns `INVALID_PLACE`; omitting `place` leaves all place fields `null`; undo removes the item
- [X] T021 [P] [US1] Extend `packages/core/tests/placement-typed.test.ts`: `addTypedPlacement(date, blockId, name, afterId, { place, type: 'food' })` stores the place fields and type; omitting `opts` keeps type `'activity'` and null place fields; invalid place returns `INVALID_PLACE`
- [X] T022 [P] [US1] Extend `packages/core/tests/placement-from-item.test.ts`: `placeItem` copies all seven place fields from a linked item; later `updateItem` on the item does not change the placement's place
- [X] T023 [P] [US1] Extend `packages/core/tests/location.test.ts` (or `day-location.test.ts`): `suggestNear(state)` returns trip `{lat, lon}`; `suggestNear(state, date)` returns the day override when set, else trip; `null` when neither is set
- [X] T024 [P] [US1] Write failing tests in `apps/web/tests/usePlaceSuggestions.test.tsx` (fake timers, fake `PlaceSearch`): no call under 3 chars; one call 300 ms after the last keystroke; stale responses (from an earlier input) are ignored; the same session token is reused until `pick()` resolves, then a new one is made; a rejected `suggest` sets `status: 'unavailable'` and clears suggestions; `pick(suggestion)` calls `details` and returns the `Place`
- [X] T025 [P] [US1] Write failing tests in `apps/web/tests/PlaceOptions.test.tsx`: renders a `role="group"` labelled "Places" with one `role="option"` per suggestion showing name and address; marks the active option `aria-selected`; mousedown on an option calls `onChoose`; shows "Powered by Google" text; renders "No places found" when given an empty list with `status: 'ready'`; renders "Place search unavailable" when `status: 'unavailable'`
- [X] T026 [P] [US1] Extend `apps/web/tests/Cell.test.tsx` and `apps/web/tests/ItemPanel.test.tsx`: typing shows place options from the fake search; ArrowDown/Enter picks one and creates a linked placement/item; Enter with no active option saves plain text; picking a food suggestion yields type Food

### Implementation for User Story 1

- [X] T027 [P] [US1] Implement `isFoodPlace` in `packages/core/src/places/food.ts` per research R5 (fixed set plus any type ending in `_restaurant`); make T019 pass
- [X] T028 [US1] Add optional `place` to `addItem` in `packages/core/src/commands/item.ts` and optional `opts: { place?: Place | null; type?: ItemType }` to `addTypedPlacement` in `packages/core/src/commands/placement.ts` (validate with `validatePlace`, store via `placeFields`); make `placeItem` copy the item's place fields; make T020–T022 pass
- [X] T029 [US1] Implement `suggestNear(state, date?)` in `packages/core/src/queries/location.ts` using `tripLocation`/`dayLocation`; make T023 pass; export `isFoodPlace` and `suggestNear` from `packages/core/src/index.ts`
- [X] T030 [US1] Implement `apps/web/src/state/usePlaceSuggestions.ts` returning `{ suggestions, status: 'idle' | 'loading' | 'ready' | 'unavailable', pick(s): Promise<Place> }` from `(text, near)`; uses `crypto.randomUUID()` session tokens; make T024 pass
- [X] T031 [US1] Implement `apps/web/src/components/places/PlaceOptions.tsx` (+ `PlaceOptions.module.css`, tokens only, reusing `CellSuggestions` option styles): `MapPin` icon, name, muted address, "Powered by Google" footer in caption size; status lines for empty and unavailable; make T025 pass
- [X] T032 [P] [US1] Implement `apps/web/src/components/places/PlaceLine.tsx` (+ css): `MapPin` icon with `aria-hidden` plus the short address text, truncated with ellipsis and full address in `title`; renders nothing for plain rows
- [X] T033 [US1] Integrate in `apps/web/src/components/grid/Cell.tsx` and `CellSuggestions.tsx`: list suggestions ("From your list") first, then the Places group; one shared `activeIndex` across both groups and `aria-activedescendant` on the input; choosing a place calls `pick`, then `addTypedPlacement(date, blockId, place.name, last?.id, { place, type: isFoodPlace(s.types) ? 'food' : 'activity' })`; `near = suggestNear(state, date)`; while `pick` is pending the input stays editable; if `pick` rejects, show "Place search unavailable" and keep the typed text
- [X] T034 [US1] Integrate in the add form of `apps/web/src/components/list/ItemPanel.tsx` (`ItemForm`): name field becomes a combobox with `PlaceOptions`; picking sets name to the place's name, holds the `Place` in form state, sets the type select to Food for food places, and shows `PlaceLine` under the field; Save passes the place to `addItem`; editing the name text after picking keeps the place (US3 scenario 4); `near = suggestNear(state)`
- [X] T035 [US1] Show linked state: `PlaceLine` under the name in each item row in `ItemPanel.tsx`; a small `MapPin` icon (with `aria-label="Linked place"`) on linked chips in `apps/web/src/components/grid/PlacementChip.tsx` and the address in the chip's details/tooltip
- [X] T036 [US1] Write e2e `apps/web/e2e/places.spec.ts` US1 tests with `mockPlaces`: quickstart scenarios 1–5 and 11; assert the recorded `suggest` body contains only `action`, `input`, `sessionToken`, `near` (FR-014)

**Checkpoint**: US1 works on its own — places can be picked and are saved, shown and synced

---

## Phase 4: User Story 2 - Open a linked place in a map app (Priority: P1)

**Goal**: Linked items and placements offer "Open in maps" with Google Maps, Apple Maps and Waze (last choice first), working even when place search is down.

**Independent Test**: Quickstart scenarios 6–8: on a linked chip, Open in maps → each app opens the right URL in a new tab; the last choice is listed first.

### Tests for User Story 2

- [X] T037 [P] [US2] Write failing tests in `packages/core/tests/places-maplinks.test.ts`: `mapLinks(place)` returns exactly the three URLs from research R6 with values URI-encoded (Google `query` = `"<name>, <address>"` and `query_place_id` = id; Apple `q` = name and `ll` = `lat,lon`; Waze `ll` = `lat,lon` and `navigate=yes`); `orderMapApps(null)` → `['google','apple','waze']`; `orderMapApps('waze')` → `['waze','google','apple']`
- [X] T038 [P] [US2] Write failing tests in `apps/web/tests/OpenInMapsItems.test.tsx`: renders a `MenuLabel` "Open in maps" and three items labelled "Google Maps", "Apple Maps", "Waze" in `orderMapApps(stored)` order; selecting one calls `window.open(url, '_blank', 'noopener,noreferrer')` and writes `cellar.mapApp` to the fake `KeyValueStore`; an unknown stored value is ignored

### Implementation for User Story 2

- [X] T039 [P] [US2] Implement `mapLinks` and `orderMapApps` in `packages/core/src/places/mapLinks.ts`; export from `packages/core/src/index.ts`; make T037 pass
- [X] T040 [US2] Implement `apps/web/src/components/places/OpenInMapsItems.tsx` (menu group for `Menu` from `components/ui/Menu.tsx`, reading/writing `cellar.mapApp` via `useServices().store`); make T038 pass
- [X] T041 [US2] Add `OpenInMapsItems` (only when `placeOf(row)` is not null) to the item row menu in `apps/web/src/components/list/ItemPanel.tsx` and the chip menu in `apps/web/src/components/grid/PlacementChip.tsx`, after a `MenuSeparator`; extend `ItemPanel.test.tsx` and `PlacementChip.test.tsx` to assert the group shows for linked rows and not for plain rows
- [X] T042 [US2] Add US2 tests to `apps/web/e2e/places.spec.ts`: quickstart scenarios 6–8 (stub `window.open` via `page.addInitScript` to capture URLs), and scenario 11's "Open in maps still works" with `mockPlaces(page, 'fail')`

**Checkpoint**: US1 + US2 deliver the full P1 value

---

## Phase 5: User Story 3 - Link, change or remove a place on an existing item (Priority: P2)

**Goal**: Existing plain items and placements can be linked later; linked ones can switch to another place or drop the link, with undo.

**Independent Test**: Quickstart scenarios 9–10: edit a plain item and pick a place → linked; Remove place → plain, name kept; Undo restores the link; renaming keeps the link.

### Tests for User Story 3

- [X] T043 [P] [US3] Extend `packages/core/tests/item.test.ts`: `updateItem(id, { place })` links; `{ place: other }` replaces; `{ place: null }` clears all seven fields and keeps name, type, notes, link; `{ name: 'Chelsea Market lunch' }` keeps the place; invalid place → `INVALID_PLACE`; each is one undo step
- [X] T044 [P] [US3] Extend `packages/core/tests/placement-typed.test.ts` (or a new `placement-place.test.ts`) with the same cases for `updatePlacement(id, { place })`

### Implementation for User Story 3

- [X] T045 [US3] Add `place?: Place | null` to `ItemPatch` in `packages/core/src/commands/item.ts` and to `PlacementPatch` in `packages/core/src/commands/placement.ts`; validate with `validatePlace` and spread `placeFields(place)` only when `place !== undefined`; make T043–T044 pass
- [X] T046 [US3] In `ItemPanel.tsx`'s edit dialog (`ItemForm` with an existing item): start with the item's `placeOf(item)`; same combobox as the add form; a "Remove place" text button next to `PlaceLine` clears it in form state; Save sends `place` to `updateItem` only when it changed; add a "Remove place" `MenuItem` to the row menu for linked items that dispatches `updateItem(id, { place: null })`
- [X] T047 [US3] In `PlacementChip.tsx`'s edit form: same combobox, `PlaceLine` and "Remove place" button, saving via `updatePlacement`; add a "Remove place" `MenuItem` for linked chips; `near = suggestNear(state, placement.date)`
- [X] T048 [US3] Extend `ItemPanel.test.tsx` and `PlacementChip.test.tsx`: editing a plain row and picking links it; Remove place clears it and keeps the name; and add US3 e2e tests (quickstart scenarios 9–10, including Undo) to `apps/web/e2e/places.spec.ts`

**Checkpoint**: All three stories work independently

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T049 [P] Add the place listbox, place line and "Open in maps" menu to the axe checks in `apps/web/e2e/a11y.spec.ts` in light and dark (quickstart scenario 12), and a 360 px check to `apps/web/e2e/layout.spec.ts` that the Places group fits without horizontal scroll
- [X] T050 [P] Confirm `apps/web/tests/no-emoji.test.ts` and `apps/web/tests/tokens.test.ts` cover the new `components/places/` files (extend their globs if needed)
- [X] T051 [P] Document setup in `README.md`: enabling Places API (New), a server key restricted to that API, daily quota caps (research R1), `supabase secrets set GOOGLE_PLACES_API_KEY=…`, `supabase functions deploy places`, and local `supabase functions serve places` with `supabase/functions/.env`
- [X] T052 Run `pnpm lint`, `pnpm --filter web typecheck`, `pnpm test`, `pnpm test:db` and `pnpm --filter web e2e`; fix failures
- [ ] T053 Walk through quickstart.md manual scenarios 1–12 against a real key (or record which ones need the user's key) and note results in the PR description (Not done: needs a real Google Places key; run by the user. Automated coverage uses the mocked function only.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup; blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after Foundational. Independent of US1 in core, but needs linked rows to show the menu; test it with rows linked directly via fixtures, or after US1
- **US3 (Phase 5)**: after US1 (reuses the combobox, `PlaceOptions` and `PlaceLine` from T030–T034)
- **Polish (Phase 6)**: after the stories you ship

### Within Each Story

Tests first (must fail) → core → web hook/components → integration → e2e.

### Parallel Opportunities

- Phase 1: T002, T003
- Phase 2: T005 with T006–T012; T013–T015 (function) in parallel with T016–T017 (adapter) once T006 and T011 are done
- US1: T019–T026 all in parallel; T027 and T032 in parallel with T028–T031
- US2: T037, T038, T039 in parallel
- US3: T043, T044 in parallel
- Polish: T049, T050, T051

## Parallel Example: User Story 1

```text
Task: "T019 isFoodPlace tests in packages/core/tests/places-food.test.ts"
Task: "T024 usePlaceSuggestions tests in apps/web/tests/usePlaceSuggestions.test.tsx"
Task: "T025 PlaceOptions tests in apps/web/tests/PlaceOptions.test.tsx"
Task: "T027 isFoodPlace in packages/core/src/places/food.ts"
Task: "T032 PlaceLine in apps/web/src/components/places/PlaceLine.tsx"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phases 1–2 (schema, types, function, adapter)
2. Phase 3 (US1) → validate quickstart 1–5 and 11 → usable: items link to real places
3. Phase 4 (US2) right after — together they are the P1 value the user asked for

### Incremental Delivery

US1 → US2 → US3, each a working increment; Polish last. Merge to `main` only after the user
confirms the feature is finished (feature-branch workflow).

---

## Phase 7: Convergence

- [X] T054 Restrict CORS in `supabase/functions/places/handler.ts` to allowed origins instead of `*`: read a comma-separated `ALLOWED_ORIGINS` env (wired in `supabase/functions/places/index.ts`; default `http://localhost:5173`), echo the request `Origin` in `access-control-allow-origin` only when it is in the list (add `vary: origin`), omit the header otherwise; document `ALLOWED_ORIGINS` in `supabase/functions/.env.example` and `README.md`; extend `supabase/tests/places-handler.test.ts` for allowed and disallowed origins per plan: contracts/places-function.md (contradicts)
- [X] T055 [P] Show the linked-place pin on the drag preview: pass `linked={placeOf(source) !== null}` to `ChipFace` in `apps/web/src/components/grid/DragLayer.tsx`, with a test in `apps/web/tests/` that a linked placement's overlay renders the "Linked place" icon per FR-006 (partial)
- [X] T056 [P] Keep only options and groups inside `role="listbox"`: move the "No places found" / "Place search unavailable" `role="status"` notes and the "Powered by Google" attribution in `apps/web/src/components/places/PlaceOptions.tsx` (and wherever `CellSuggestions.tsx` and `PlaceNameField.tsx` host it) to siblings after the listbox, keeping them visible in the same popup; update `apps/web/tests/PlaceOptions.test.tsx` and run the axe checks in `apps/web/e2e/a11y.spec.ts` per Constitution II (partial)
- [X] T057 [P] Add a test to `apps/web/tests/Cell.test.tsx`: when the fake `PlaceSearch.details` rejects after picking a place, the typed text stays in the input, "Place search unavailable" is shown, no placement is created, and the highlighted option resets (`aria-activedescendant` cleared); fix `apps/web/src/components/grid/Cell.tsx` if it fails per T033 (partial)
