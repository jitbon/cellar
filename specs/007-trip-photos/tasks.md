---

description: "Task list for Trip Photos"
---

# Tasks: Trip Photos

**Input**: Design documents from `/specs/007-trip-photos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/core.md,
contracts/database.md, contracts/places-function.md, quickstart.md

**Tests**: Included. Constitution Principle V requires tests for core logic; research R8 lists
core, web, handler, DB and e2e tests. Tests are written first and must fail before the matching
implementation.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to (US1–US4)

## Path Conventions

Monorepo: `packages/core/`, `apps/web/`, `supabase/`. Ref docs (under `specs/007-trip-photos/`):
research = `research.md`, data-model = `data-model.md`, core contract = `contracts/core.md`, DB
contract = `contracts/database.md`, function contract = `contracts/places-function.md`. Builds
on features 002 (`todayIn`, `setTripLocation`, `KeyValueStore`), 004/006 (`PlaceSearch`,
`places` Edge Function, `PopularCard`, `PopularTab`, session popular cache) and the shared
`Dialog`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fixtures, mocks and tokens used by every story

- [X] T001 [P] Add e2e fixtures in `apps/web/e2e/fixtures/`: small JPEG test images `photo-a.jpg`, `photo-b.jpg` (any 64×40 images), and Wikimedia API responses for "Kyoto, Japan": `wikimedia-search-kyoto.json` (generator=search result with page "Kyoto" and `pageimage` "Kyoto_A.jpg"), `wikimedia-images-kyoto.json` (generator=images with 8 files: 6 landscape JPEGs plus `Kyoto_map.svg` and `Flag_of_Japan.png`), `wikimedia-imageinfo.json` (imageinfo for each JPEG: `thumburl`, `thumbwidth` 1280, `thumbheight` 720, `descriptionurl`, `extmetadata.Artist.value` `<a href="…">Jane Doe</a>`, `LicenseShortName.value` `CC BY-SA 4.0`)
- [X] T002 Add `mockWikimedia(page, mode: 'ok' | 'fail')` to `apps/web/e2e/helpers.ts`: routes `https://en.wikipedia.org/w/api.php**` and `https://commons.wikimedia.org/w/api.php**` to the fixtures by query (`generator=search` / `generator=images` / `prop=imageinfo`), and `https://upload.wikimedia.org/**` to `photo-a.jpg`; `fail` returns 503. Make `signIn` install `mockWikimedia(page, 'fail')` unless the page already mocked it (same pattern as the existing `places` default), so no spec reaches Wikimedia. Extend `mockPlaces` so `popular` results include `photo: { name: 'places/test-met/photos/p1', author: 'Ann Lee', authorUri: 'https://maps.google.com/contrib/1' }` for each fixture place, `photo` actions return `{ photoUri: '<page origin>/__test-photo/<name>.jpg' }` (recorded like other requests), and route `**/__test-photo/**` to `photo-b.jpg`
- [X] T003 [P] Add tokens to `apps/web/src/styles/tokens.css` (light block; dark overrides where a color): `--color-photo-overlay` (navy at ~62% opacity: light `rgb(11 45 99 / 62%)`, dark `rgb(5 12 26 / 70%)`), `--color-on-photo: #ffffff`, `--size-banner: 84px`, `--size-banner-sm: 56px`, `--size-thumb: 40px`, `--size-cover: 150px`; add them to the family list in `apps/web/tests/tokens.test.ts` and a contrast pair test for `on-photo` over a fully opaque overlay color in both themes (write the test first)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, ports, migration, relay changes and adapters that the stories need

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `supabase/migrations/0009_cover_photo.sql` exactly as contracts/database.md: `cover_photo text null` with check "`cover_photo is null or char_length(cover_photo) between 1 and 300`"; apply locally with `supabase migration up --local` (never `db reset`)
- [X] T005 [P] Write DB tests in `supabase/tests/cover-photo.test.ts` (style of `place-columns.test.ts`): null and `"Kyoto_A.jpg"` accepted; `""` and a 301-char string rejected; another user cannot update `cover_photo`
- [X] T006 Extend `packages/core/src/model/types.ts` per contracts/core.md: `coverPhoto: string | null` on `Trip` (set `null` in `createTrip` and every `Trip` literal in core and tests), `CityPhoto`, `PlacePhotoRef`, `photo: PlacePhotoRef | null` on `PopularPlace`, `TripStatus`; add `CityPhotoService` to `packages/core/src/ports.ts` and `photoUrl(photoName, maxWidthPx)` to `PlaceSearch`; update fakes in `apps/web/tests/setup.ts` (`fakePlaceSearch().photoUrl`, new `fakeCityPhotos()`), and the e2e/web fixtures' `PopularPlace` objects (`photo: null` where not set) so the build passes
- [X] T007 [P] Write failing tests in `supabase/tests/places-handler.test.ts`: `popular` field mask now ends with `,places.photos` and maps `photos[0]` to `photo: { name, author: authorAttributions[0].displayName, authorUri: authorAttributions[0].uri ?? null }` (null when no photos); `photo` action GETs `https://places.googleapis.com/v1/<name>/media?maxWidthPx=<n>&skipHttpRedirect=true` with `X-Goog-Api-Key` and returns `{ photoUri }`; 400 when `name` does not match `^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$` or `maxWidthPx` is not an integer 48–1600; 503 on Google non-2xx or missing `photoUri`
- [X] T008 Implement the `popular` change and the `photo` action in `supabase/functions/places/handler.ts`; make T007 pass
- [X] T009 [P] Write failing tests in `apps/web/tests/supabasePlaceSearch.test.ts`: `popular` passes `photo` through; `photoUrl(name, 160)` invokes `places` with `{ action: 'photo', name, maxWidthPx: 160 }` and returns `photoUri`; rejects on error
- [X] T010 Implement `photoUrl` and the `photo` mapping in `apps/web/src/adapters/supabasePlaceSearch.ts`; make T009 pass
- [X] T011 [P] Write failing tests in `apps/web/tests/wikimediaCityPhotos.test.ts` (mocked `fetch`, in-memory `KeyValueStore`, fixed `now`): `lead('Kyoto, Japan')` calls the search URL from research R1 (with `origin=*` and an `Api-User-Agent` header), then Commons imageinfo, returning `{ file: 'Kyoto_A.jpg', url, width, height, credit: 'Jane Doe', license: 'CC BY-SA 4.0', sourceUrl }` (Artist HTML stripped to text, "Unknown" when missing); `null` when the search finds nothing or the page has no image; `more(name, 6)` returns at most 6, lead first, skipping svg and names containing map/flag/logo/seal/coat/locator and non-landscape images; `byFile` returns the photo or `null`; results are cached under `cellar.cityPhoto.lead.<name>` / `.more.<name>` for 7 days and refetched after; any fetch failure rejects
- [X] T012 Implement `apps/web/src/adapters/wikimediaCityPhotos.ts` (`WikimediaCityPhotos implements CityPhotoService`); make T011 pass; add `cityPhotos` to `Services` in `apps/web/src/state/services.tsx` (with a null-safe `useCityPhotos()` hook like `usePlaceSearch`) and wire it in `apps/web/src/main.tsx`
- [X] T013 [P] Add `PhotoCredit` in `apps/web/src/components/photos/PhotoCredit.tsx` (+ css, tokens only): renders "Photo: <credit> · <license>" (or "Photo: <author>" for Google) as a link to the source in a new tab with `rel="noopener noreferrer"`; a `variant` for light text over photos; unit test in `apps/web/tests/PhotoCredit.test.tsx`

**Checkpoint**: Photos can be fetched end to end through both ports

---

## Phase 3: User Story 1 - Trip cards show a city photo (Priority: P1) 🎯 MVP

**Goal**: "Your trips" cards show the city photo (or a chosen cover) with credit and a status pill; the cover can be changed.

**Independent Test**: Quickstart 1–4.

### Tests for User Story 1

- [X] T014 [P] [US1] Write failing tests in `packages/core/tests/status.test.ts`: `tripStatus` for before (days = start − today), first day (`during`, day 1), last day (`during`, day = of), after; `tripStatusLabel`: "In 1 day", "In 12 days", "Day 2 of 5", "Ended"; `tripToday` uses the trip location's time zone when set (a fixed `now` near midnight UTC gives different dates for Tokyo vs UTC) and the device's otherwise
- [X] T015 [P] [US1] Write failing tests in `packages/core/tests/trip.test.ts` and `location.test.ts`: `setTripCoverPhoto('Kyoto_B.jpg')` sets `coverPhoto` (one trips upsert, undo restores `null`); `''` and 301 chars → validation error; `setTripCoverPhoto(null)` clears; `setTripLocation` to a different location clears `coverPhoto`, setting the same location keeps it
- [X] T016 [P] [US1] Write failing tests in `apps/web/tests/useCityPhoto.test.tsx` and `apps/web/tests/Trips.test.tsx` (fake `CityPhotoService`): a located trip's card shows the lead photo (`img` with alt "<city>" and reserved `--size-cover` height), `PhotoCredit` and the status pill; a trip with `coverPhoto` uses `byFile`; no location → placeholder and "Set a location to get a cover photo"; service failure or `null` → placeholder without that text; the card still links to the trip in every case
- [X] T017 [P] [US1] Write failing tests in `apps/web/tests/CoverPhotoPicker.test.tsx`: lists up to 6 choices from `more()` as radio-like buttons with images and credits, the current one marked selected; picking one calls `onPick(file)`; "Use automatic photo" calls `onPick(null)`; failure shows "Photos unavailable right now"

### Implementation for User Story 1

- [X] T018 [US1] Implement `tripToday`, `tripStatus`, `tripStatusLabel` in new `packages/core/src/queries/status.ts`; `setTripCoverPhoto` in `packages/core/src/commands/trip.ts` (validate "1–300 chars"); clear `coverPhoto` on location change in `packages/core/src/commands/location.ts`; export all; make T014–T015 pass
- [X] T019 [US1] Implement `apps/web/src/state/useCityPhoto.ts` (`(trip) => { photo, status: 'loading' | 'ready' | 'none' }`, using `byFile(coverPhoto)` then falling back to `lead(locationName)`)
- [X] T020 [US1] Implement `apps/web/src/components/photos/CoverPhotoPicker.tsx` (+ css) in the shared `Dialog`; make T017 pass
- [X] T021 [US1] Update trip cards in `apps/web/src/pages/Trips.tsx` (+ `Trips.module.css`): photo area of height `var(--size-cover)` with the image (`object-fit: cover`), status pill from `tripStatusLabel(tripStatus(trip, tripToday(...)))`, `PhotoCredit` under the details, placeholder states, and a "Change cover photo" `MenuItem` in the card menu (located trips only) that opens `CoverPhotoPicker` and saves via the repository with an undo-capable command like Rename does; make T016 pass
- [X] T022 [US1] Write e2e `apps/web/e2e/photos.spec.ts` US1 tests with `mockWikimedia`: quickstart 1–4 (cards, placeholder, change cover, automatic, location change clears) and the `fail` mode placeholder

**Checkpoint**: Trip cards have photos (MVP)

---

## Phase 4: User Story 2 - City banner and today highlight (Priority: P2)

**Goal**: A hideable faded city banner on the trip page and a "Today" day header.

**Independent Test**: Quickstart 5–6.

### Tests for User Story 2

- [X] T023 [P] [US2] Write failing tests in `apps/web/tests/CityBanner.test.tsx`: shows photo, overlay, city name, `tripStatusLabel` text and credit for a located trip with a photo; nothing for no location or no photo; hidden when `cellar.banner.hidden` is `"1"` in the store
- [X] T024 [P] [US2] Extend `apps/web/tests/TripHeader.test.tsx` (create if missing) and `apps/web/tests/Grid.test.tsx` (or the closest existing grid test): trip menu shows "Hide city banner" / "Show city banner" and toggles the store key; today's day header has the "Today" label and the today class, other days don't; no label when today is outside the trip

### Implementation for User Story 2

- [X] T025 [US2] Implement `apps/web/src/components/layout/CityBanner.tsx` (+ css): height `var(--size-banner)` (`var(--size-banner-sm)` under 640 px), image `object-fit: cover`, overlay `var(--color-photo-overlay)`, text `var(--color-on-photo)`, `PhotoCredit` light variant; render it under the header in `apps/web/src/pages/TripPlanner.tsx`; make T023 pass
- [X] T026 [US2] Add the hide/show `MenuItem` to `apps/web/src/components/layout/TripHeader.tsx` (state from `useKeyValueStore`, shared with `CityBanner` via a small `useBannerHidden()` hook in `apps/web/src/state/`), and the today header (accent-soft background via existing tokens plus a "Today" text) in `apps/web/src/components/grid/Grid.tsx` using `tripToday`; make T024 pass
- [X] T027 [US2] Add US2 e2e tests to `apps/web/e2e/photos.spec.ts`: quickstart 5–6 (banner, hide, reload stays hidden, show again; today label for a trip spanning today)

---

## Phase 5: User Story 3 - Popular card thumbnails (Priority: P2)

**Goal**: Small place photos on Popular cards, loaded only when in view, with attributions.

**Independent Test**: Quickstart 7.

### Tests for User Story 3

- [X] T028 [P] [US3] Write failing tests in `apps/web/tests/usePlacePhoto.test.tsx` (mocked `IntersectionObserver`, fake `PlaceSearch`): no `photoUrl` call before the element intersects; one call after; a second hook for the same photo name reuses the session result; failure → `status: 'none'`; a `null` photo ref never calls
- [X] T029 [P] [US3] Extend `apps/web/tests/PopularTab.test.tsx`: each card has a thumbnail slot of size `var(--size-thumb)` with a placeholder (type icon) until the photo resolves, then an `img` with alt "" and a title/accessible description "Photo: <author>"; the list footer reads "Photos: <author A>, <author B>" for loaded photos, linked to `authorUri`

### Implementation for User Story 3

- [X] T030 [US3] Implement `apps/web/src/state/usePlacePhoto.ts` (`(ref, maxWidthPx) => { ref: callback ref, url, status }`, module-level session `Map` by photo name, `IntersectionObserver` with `rootMargin: '100px'`); make T028 pass
- [X] T031 [US3] Add the thumbnail to `apps/web/src/components/list/PopularCard.tsx` (+ css, `maxWidthPx` 160) and the "Photos: …" footer to `PopularTab.tsx` (authors of loaded photos in this group); make T029 pass
- [X] T032 [US3] Add US3 e2e tests to `apps/web/e2e/photos.spec.ts`: on a 360 px-tall viewport only the visible cards' `photo` requests are recorded, more after scrolling the panel; footer credits visible

---

## Phase 6: User Story 4 - Popular card detail view (Priority: P3)

**Goal**: Clicking or pressing Enter on a Popular card opens a detail dialog with a big photo, details, where it is planned and its actions.

**Independent Test**: Quickstart 8–9.

### Tests for User Story 4

- [X] T033 [P] [US4] Write failing tests in `packages/core/tests/placed.test.ts`: `placementsOfPlace(state, placeId)` returns `{ date, blockName }` for each placement with that `placeId`, sorted by date then block position; `[]` when none
- [X] T034 [P] [US4] Write failing tests in `apps/web/tests/Dialog.test.tsx`: with `closeOnBackdrop`, a click on the backdrop (not inside the dialog) calls `onClose`; without it, nothing happens
- [X] T035 [P] [US4] Write failing tests in `apps/web/tests/PlaceDetail.test.tsx`: dialog named after the place shows a large photo (via `photoUrl` at 800 px) with "Photo: <author>" credit, kind · address, rating with review count, "Planned: Mon May 3 · Morning" lines from `placementsOfPlace` (none when unplaced), and buttons "Place in a block", "Add to my list", "Open in maps" that call the same handlers as the card menu; "Place in a block" closes it after placing; placeholder when the photo fails
- [X] T036 [P] [US4] Extend `apps/web/tests/PopularTab.test.tsx`: clicking a card body opens the detail; the card's name is a button that opens it with Enter; clicking the menu button does not open it

### Implementation for User Story 4

- [X] T037 [US4] Implement `placementsOfPlace` in `packages/core/src/queries/placed.ts` and the `closeOnBackdrop` prop in `apps/web/src/components/ui/Dialog.tsx`; make T033–T034 pass
- [X] T038 [US4] Implement `apps/web/src/components/list/PlaceDetail.tsx` (+ css, tokens only; photo area 16:9 with reserved height, credit over the photo with the overlay token); open it from `PopularCard.tsx` on card-body click (ignore clicks from buttons) and from the name button; make T035–T036 pass
- [X] T039 [US4] Add US4 e2e tests to `apps/web/e2e/photos.spec.ts`: quickstart 8–9 (open by click and Enter, planned lines after placing, actions, X/Esc/backdrop close, dragging a card does not open it)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T040 [P] Add axe checks (light and dark) in `apps/web/e2e/a11y.spec.ts` for "Your trips" with photos, the cover picker, the banner and the place detail; add 360 px checks in `apps/web/e2e/layout.spec.ts` (banner uses the small height, trip cards and detail fit without horizontal scroll)
- [X] T041 [P] Document in `README.md`: Wikimedia city photos (free, credited, 7-day device cache), Google place photos (Place Details Photos: 1,000 free/month, then $7 per 1,000), a daily quota cap of ~60 on Place Photos, photo names never stored (Google terms), and `supabase migration up --local` for 0009
- [X] T042 Respect reduced motion (no fade/zoom on photo load) and check dark mode readability of credits over photos in `CityBanner`, `PlaceDetail` and trip cards
- [X] T043 Run `pnpm lint`, `pnpm --filter web typecheck`, `pnpm test`, `pnpm test:db` and the full e2e suite; fix failures
- [ ] T044 Walk through quickstart.md scenarios 1–11 with real Wikimedia and the real Google key (or record which need the user)

---

## Dependencies & Execution Order

- **Setup (1)** → **Foundational (2)** → stories
- **US1 (3)**: after Foundational
- **US2 (4)**: after Foundational; reuses `useCityPhoto` and `tripStatus` from US1 (do US1 first)
- **US3 (5)**: after Foundational; independent of US1/US2
- **US4 (6)**: after Foundational; reuses `usePlacePhoto` from US3 for the big photo (do US3 first)
- **Polish (7)**: after the stories you ship

### Parallel Opportunities

- Phase 1: T001, T003
- Phase 2: T005, T007, T009, T011, T013 (after T006)
- US1: T014–T017; US3: T028–T029; US4: T033–T036
- US1+US2 (city photos) and US3+US4 (place photos) are two independent tracks
- Polish: T040, T041

## Parallel Example: User Story 1

```text
Task: "T014 status tests in packages/core/tests/status.test.ts"
Task: "T015 cover photo command tests in packages/core/tests/trip.test.ts"
Task: "T016 trip card tests in apps/web/tests/Trips.test.tsx"
Task: "T017 cover picker tests in apps/web/tests/CoverPhotoPicker.test.tsx"
```

## Implementation Strategy

### MVP First

Phases 1–3 (trip card photos with cover choice): free, the biggest visual payoff.

### Incremental Delivery

US1 → US2 (free city photos), then US3 → US4 (paid place photos); Polish last. Merge to
`main` only after the user confirms the feature is finished.

---

## Phase 8: Convergence

- [ ] T045 Make the grid's height account for the city banner: while `CityBanner` is shown, set `--grid-chrome` on the trip page container (in `apps/web/src/pages/TripPlanner.tsx` / its CSS) to `var(--size-banner)` (and `var(--size-banner-sm)` under 640 px) so `Grid.module.css`'s `max-height: calc(100dvh - var(--size-header) - var(--grid-chrome, 0px))` leaves no page-level scroll; add a 360 px and a desktop check to `apps/web/e2e/layout.spec.ts` that with the banner shown `document.documentElement.scrollHeight <= innerHeight` on the trip page per US2/AC5 and FR-010 (partial)
- [ ] T046 Remove the import cycle between `apps/web/src/components/list/PlaceDetail.tsx` and `PopularCard.tsx` by moving `ratingText` into a small shared module (e.g. `apps/web/src/components/list/rating.ts`) imported by both; no behavior change per Constitution V (unrequested)
