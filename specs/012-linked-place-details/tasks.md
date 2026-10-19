---

description: "Task list for Details for Linked Places"
---

# Tasks: Details for Linked Places

**Input**: Design documents from `/specs/012-linked-place-details/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/places-info.md,
quickstart.md

**Tests**: Included. Constitution Principle V requires tests for core logic; research R7 lists
core, function, web and e2e tests. Tests are written first and must fail before the implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to (US1–US3)

## Path Conventions

Monorepo: `packages/core/`, `apps/web/`, `supabase/`. Decisions: research.md R1–R7. Shapes:
data-model.md. Request/response, UI layout and text: contracts/places-info.md.

---

## Phase 1: Foundational (Blocking Prerequisites)

- [ ] T001 Add `PlaceInfo`, `WeeklyHours`, `DayTime` (`day: 0..6` with "Sunday = 0"), `HoursLine` (`kind: 'closed' | 'open-24h' | 'open'`, `ranges: { openMin, closeMin }[]`, "closeMin may exceed 1440 for past-midnight closing") and `OpeningHours` (`today`, `week` "7 lines, Monday first") to `packages/core/src/model/types.ts`; add `info(placeId: string): Promise<PlaceInfo>` to `PlaceSearch` in `packages/core/src/ports.ts` (rejects with an error whose `code` is `'not-found'` when the place is gone); add an `openingHours` stub returning `null` in new `packages/core/src/places/hours.ts`; export all from `packages/core/src/index.ts`
- [ ] T002 [P] Write failing table tests in `packages/core/tests/opening-hours.test.ts` for `openingHours({ hours, utcOffsetMinutes }, now)`: one daily range 09:00–21:00 → today `open` [540, 1260]; lunch + dinner ranges on one day → two ranges in order; Friday 18:00 → Saturday 02:00 → Friday range [1080, 1560] and Saturday not opened by it; single period `open` day 0 00:00 with no `close` → every day `open-24h`; a day with no period → `closed`; `hours: null` → `null`; `now` = 2027-04-02T16:00Z with `utcOffsetMinutes: 540` (Tokyo, already Saturday) → today is Saturday, with `-300` (New York, Friday) → Friday; `utcOffsetMinutes: null` → the runtime's local day; `week` has 7 lines Monday→Sunday
- [ ] T003 Implement `openingHours` in `packages/core/src/places/hours.ts` per research R3; make T002 pass
- [ ] T004 [P] Write failing handler tests in `supabase/tests/places-handler.test.ts` (`describe('handlePlaces info')`): sends `GET {GOOGLE}/places/{id}` with no `sessionToken` and `X-Goog-FieldMask: id,displayName,types,primaryTypeDisplayName,rating,userRatingCount,photos,regularOpeningHours,utcOffsetMinutes,websiteUri`; maps to `{ info: { placeId, name, kind, types, rating, ratingCount, photo, hours: { periods }, utcOffsetMinutes, website } }` (first photo like `popular`; missing fields → `null`/`''`/`[]`); drops a non-http(s) `websiteUri`; rejects input other than a 1–300 char `placeId` with 400; Google 404 → status 404 `{ error: 'not-found' }`; Google 500 or timeout → 503
- [ ] T005 Implement the `info` action in `supabase/functions/places/handler.ts` (add to the allowed `actions` list, reuse `GooglePlace`, `firstPhoto`, `TIMEOUT_MS`, `json`, `unavailable`, `badRequest`); make T004 pass (`pnpm test:db` with the usual env vars)
- [ ] T006 Add `info(placeId)` to `apps/web/src/adapters/supabasePlaceSearch.ts` (POST `{ action: 'info', placeId }`; 404 body → reject with `Object.assign(new Error('not-found'), { code: 'not-found' })`; other failures reject) and an adapter test next to the existing ones in `apps/web/tests/`
- [ ] T007 Extend `fakePlaceSearch` in `apps/web/tests/setup.ts` with `info` (option `info?: (placeId) => PlaceInfo`, `infoFail?: boolean`, `infoNotFound?: boolean`; default returns a Chelsea Market info with hours Mon–Sun 09:00–21:00, rating 4.6 / 31204, website `https://chelseamarket.com/`) and update any other `PlaceSearch` fakes so typecheck passes
- [ ] T008 [P] Write failing `apps/web/tests/usePlaceInfo.test.tsx`: returns `{ status: 'loading' }` then `{ status: 'ready', info }`; a second hook for the same id makes no second `info` call (SC-003); two hooks mounted together share one request; failure → `{ status: 'unavailable' }` and a later mount retries; not-found → `{ status: 'not-found' }` and is not retried in the session; `placeId: null` → `{ status: 'idle' }` with no call
- [ ] T009 Implement `apps/web/src/state/usePlaceInfo.ts` per research R4 (module-level `WeakMap<PlaceSearch, Map<string, PlaceInfo | 'not-found'>>` plus pending map, pattern of `usePopularPlaces.ts`); make T008 pass

**Checkpoint**: Function, port, adapter, hook and hours logic tested

---

## Phase 2: User Story 1 - See a linked list item's details (Priority: P1) 🎯 MVP

**Goal**: A linked My-list item opens the same detail view as Popular, with hours and website.

**Independent Test**: Quickstart 1, 2, 4, 5, 8.

### Tests for User Story 1

- [ ] T010 [P] [US1] Extend `apps/web/tests/PlaceDetail.test.tsx` (keep existing Popular cases passing): a `linked` subject (stored `Place` + "Place in a block" action) shows name, address and Open in maps at once and a `role="status"` "Loading details…" line, then photo with credit, kind, "★ 4.6 (31,204)" style rating, "Open today 9:00 AM–9:00 PM" (en-US) and a "Show week" button that toggles `aria-expanded` and shows 7 lines with today marked "Today", and a "Website" link with `target="_blank"` and `rel="noreferrer"`; a Popular subject also shows the hours and website after info loads; with no hours or no website those parts are absent; "Closed today" and "Open 24 hours" render for those kinds
- [ ] T011 [P] [US1] Extend `apps/web/tests/ItemPanel.test.tsx`: a linked item's name is a button named after the item that opens a dialog named after the place; its menu has "View details" as the first item; double-clicking the row still opens Edit; an unlinked item's name is plain text and its menu has no "View details" (FR-009); the view's "Place in a block" opens the block picker for that item

### Implementation for User Story 1

- [ ] T012 [US1] Generalize `apps/web/src/components/list/PlaceDetail.tsx` (+ `PlaceDetail.module.css`, tokens only) per research R5 and contracts/places-info.md: props `subject` (`name`, `address`, `kind`, optional `rating`/`ratingCount`/`photo`, the `Place` for Open in maps, `placeId` for planned dates, item `type` for the icon) and `actions: ReactNode`; uses `usePlaceInfo(placeId)` to fill missing facts and add the hours line (formatted with `Intl.DateTimeFormat(navigator.language, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })` on minutes), "Show week" disclosure and Website link; loading status line; update `apps/web/src/components/list/PopularCard.tsx` to pass its place and existing three actions; make T010 pass
- [ ] T013 [US1] In `apps/web/src/components/list/ItemPanel.tsx` `ItemRow`: for linked items render the name as a button (opens the view; stop the event so the row's double-click edit does not also fire) and add "View details" as the first menu item; render `PlaceDetail` with actions "Place in a block" (opens the existing `CellPickerDialog`) and Open in maps; make T011 pass
- [ ] T014 [US1] Extend `mockPlaces` in `apps/web/e2e/helpers.ts` to answer `action: 'info'` (`'ok'` → Chelsea Market info with hours and website, plus a photo name handled by the existing photo mock; `'fail'` → 503) and add a way to make only `info` fail or return 404 for one test
- [ ] T015 [US1] Add e2e in `apps/web/e2e/places.spec.ts`: add "Chelsea Market" to My list from a suggestion, click its name → dialog shows kind, rating, "Open today", Website link, "Show week" lines, Open in maps; close and reopen → no second `info` request (count requests); place it on two days → both planned dates shown; an unlinked item has no View details; Popular card detail shows hours and website (in `apps/web/e2e/photos.spec.ts` where Popular detail is tested)

**Checkpoint**: Linked list items and Popular show full details

---

## Phase 3: User Story 2 - See a linked event's details from the schedule (Priority: P2)

**Goal**: "View details" in a linked event's menu opens the view; clicking the event still edits.

**Independent Test**: Quickstart 3.

- [ ] T016 [P] [US2] Extend `apps/web/tests/PlacementChip.test.tsx`: a linked event's menu has "View details" first and opens the place dialog with actions "Edit event" and Open in maps (no "Place in a block"); "Edit event" closes the view and opens the edit dialog; clicking the chip still opens edit; an unlinked event has no "View details"
- [ ] T017 [US2] Add "View details" to the menu in `apps/web/src/components/grid/PlacementChip.tsx` for linked events and render `PlaceDetail` with "Edit event" and Open in maps; make T016 pass
- [ ] T018 [US2] Extend `apps/web/e2e/places.spec.ts`: place the linked item, open the event's menu → View details → dialog with rating and Edit event; clicking the event opens edit

---

## Phase 4: User Story 3 - Details when the provider is unavailable (Priority: P2)

**Goal**: The view always opens with the stored facts and an honest note.

**Independent Test**: Quickstart 6.

- [ ] T019 [P] [US3] Extend `apps/web/tests/PlaceDetail.test.tsx`: info failure → name, address, planned dates, Open in maps and the type icon show with "More details aren't available right now."; not-found → "This place may no longer be listed."; nothing in the view blocks closing or the actions
- [ ] T020 [US3] Implement the unavailable and not-found notes in `apps/web/src/components/list/PlaceDetail.tsx` (muted text, not color-only); make T019 pass
- [ ] T021 [US3] Extend `apps/web/e2e/places.spec.ts`: with `info` failing, a linked item's details show the stored facts and the unavailable note, and the trip stays editable

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T022 [P] Extend `apps/web/e2e/a11y.spec.ts`: the linked-item detail view with hours expanded, light and dark, no serious axe violations; extend `apps/web/e2e/layout.spec.ts` (mobile-360): the view fits without horizontal scroll and the week list is readable
- [ ] T023 [P] Update `README.md`: lower the suggested Place Details cap from 300 to about 100 requests per day and say why (shared with autocomplete picks; detail views use Place Details Enterprise), per research R2
- [ ] T024 Run `pnpm lint`, `pnpm --filter web typecheck`, `pnpm test`, `pnpm test:db` and the full e2e suite; fix failures (known flakes: `e2e/perf.spec.ts` under load, `e2e/sync.spec.ts` FR-002)
- [ ] T025 Walk through `specs/012-linked-place-details/quickstart.md` live scenarios 1–8 with the real `places` function where available; record which were run

---

## Dependencies & Execution Order

- Foundational (T001–T009) → US1 (T010–T015) → US2 (T016–T018) and US3 (T019–T021) → Polish.
- T002 ∥ T004 ∥ T008 (tests in different packages); T003 after T002; T005 after T004; T009 after T007–T008.
- US2 and US3 both depend on the generalized `PlaceDetail` (T012); US3 edits the same file as T012, so run it after US1.

## Parallel Examples

- Foundational: T002, T004 and T008 together; then T003, T005, T006.
- US1 tests: T010 and T011 together.
- After US1: T016 and T019 (different test files).
- Polish: T022 and T023.

## Implementation Strategy

US1 alone is the MVP (linked list items and Popular get the full view with hours and website).
Then the schedule entry (US2) and the unavailable path (US3), then polish. Merge to `main` after
the project owner confirms.
