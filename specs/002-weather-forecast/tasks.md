---

description: "Task list for Weather Forecast on the Schedule"
---

# Tasks: Weather Forecast on the Schedule

**Input**: Design documents from `/specs/002-weather-forecast/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/core.md,
contracts/database.md, quickstart.md

**Tests**: Included. Constitution Principle V requires automated tests for core domain logic;
research R12 lists the web, DB, and e2e tests. Tests are written first and must fail before the
matching implementation.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to (US1–US3)

## Path Conventions

Monorepo per plan.md: `packages/core/`, `apps/web/`, `supabase/`. Ref docs (all under
`specs/002-weather-forecast/`): research = `research.md`, data-model = `data-model.md`, core
contract = `contracts/core.md`, DB contract = `contracts/database.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Folders and test fixtures used by every story

- [X] T001 Create folders `packages/core/src/weather/` and `apps/web/src/components/weather/`, and add Open-Meteo fixtures in `apps/web/e2e/fixtures/`: `open-meteo-forecast.json` (Forecast API response shape with `timezone`, `hourly.time`, `hourly.weather_code`, `hourly.temperature_2m`, `hourly.precipitation_probability` for 16 days starting today, where every day is code 0 from 06:00–13:59 and code 61 with 70% rain from 14:00–17:59, else code 2), `open-meteo-geocode-kyoto.json` (Geocoding API `results` with Kyoto, Japan: latitude 35.0211, longitude 135.7538, timezone "Asia/Tokyo", plus Osaka and Sapporo entries), and `open-meteo-geocode-empty.json` (`{}`)
- [X] T002 [P] Add `mockOpenMeteo(page, mode: 'ok' | 'fail')` to `apps/web/e2e/helpers.ts`: routes `https://api.open-meteo.com/**` to the forecast fixture (or HTTP 503 when `fail`) and `https://geocoding-api.open-meteo.com/**` to the Kyoto fixture, or to the empty fixture when the `name` query param is "zzzxqq"; also add `setTripLocationDirect(tripId, {name, lat, lon, tz})` that updates the `trips` row's `location_*` columns with the test's Supabase client

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, types, ports, trip location storage, and the Open-Meteo adapter that all stories need

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create `supabase/migrations/0006_weather.sql` per contracts/database.md: add to `trips` and `day_settings` the columns `location_name text null`, `location_lat double precision null`, `location_lon double precision null`, `location_tz text null`; add to `blocks` `window_start_min integer null`, `window_end_min integer null`; constraints: "`location_*` all null or all non-null", "`char_length(btrim(location_name)) between 1 and 120`; lat in [−90, 90]; lon in [−180, 180]; `char_length(location_tz) > 0`", "`window_*` both null or both non-null; each in [0, 1439]; `window_start_min <> window_end_min`". No backfill
- [ ] T004 [P] Write DB tests in `supabase/tests/weather-columns.test.ts` (style of `supabase/tests/rls.test.ts`, helpers from `supabase/tests/helpers.ts`): partial location rejected; name of 121 chars rejected; lat 91 / lon −181 rejected; window 1440 or start = end rejected; one window column alone rejected; valid location + window `23:00–02:00` (1380, 120) accepted; another user cannot read or update the new columns (RLS unchanged)
- [X] T005 Extend `packages/core/src/model/types.ts` per contracts/core.md: `LocationFields` (`locationName`, `locationLat`, `locationLon`, `locationTz`, all `| null`) mixed into `Trip` and `DaySetting`; `windowStartMin: number | null; windowEndMin: number | null` on `Block`; new types `Location`, `TimeWindow`, `WeatherCondition`, `ForecastHour`, `Forecast`, `CellWeather`, `DayForecastStatus`
- [X] T006 Add `validateLocation(loc)` and `validateWindow(win)` to `packages/core/src/model/validation.ts` and error codes `INVALID_LOCATION`, `INVALID_WINDOW` in `packages/core/src/model/errors.ts`. Rules (data-model.md, "Validation summary"): "Location: all-or-nothing; name trimmed 1–120; lat/lon in range; tz non-empty." "Block window: integers 0–1439, start ≠ end, both or neither."
- [X] T007 Update `packages/core/tests/fixtures.ts` and every place in `packages/core/src` that builds a `Trip`, `DaySetting`, or `Block` literal (`commands/trip.ts`, `commands/block.ts`, `commands/daySetting.ts`) to set the new fields to `null` so the build passes; run `pnpm --filter @cellar/core test` and confirm all 001 tests still pass
- [X] T008 Add `WeatherService` and `KeyValueStore` interfaces to `packages/core/src/ports.ts` exactly as in contracts/core.md "Platform ports"
- [X] T009 [P] Write failing tests in `packages/core/tests/location.test.ts`: `setTripLocation(loc)` sets the four fields and emits one `trips` upsert change; `setTripLocation(null)` clears them; invalid location (empty name, lat 100) returns `INVALID_LOCATION`; undo restores the previous location; `tripLocation(state)` returns a `Location` or `null`; `dayLocation(state, date)` returns the day override when the day's `DaySetting` has location fields, else the trip location; `dayLocationOverride` returns only the override
- [X] T010 Implement `setTripLocation` in new `packages/core/src/commands/location.ts` (use `commit` from `commands/diff.ts` like other commands) and `tripLocation`, `dayLocation`, `dayLocationOverride` in new `packages/core/src/queries/location.ts`; make T009 pass
- [X] T011 Export the new types, ports, commands, and queries from `packages/core/src/index.ts`
- [X] T012 [P] Create `apps/web/src/adapters/localStorageStore.ts` implementing `KeyValueStore` over `window.localStorage`, with every call wrapped in try/catch (`get` returns `null` on failure; `set`/`remove` swallow errors)
- [X] T013 [P] Write failing tests in `apps/web/tests/openMeteoWeatherService.test.ts` with mocked `fetch`: `forecast()` requests `https://api.open-meteo.com/v1/forecast` with `latitude`, `longitude`, `hourly=weather_code,temperature_2m,precipitation_probability`, `timezone=auto`, `forecast_days=16` and no other trip data; maps the response to `Forecast` (`hours[i] = { time, code, tempC, rainPct }`, `rainPct` null when the value is null, `fetchedAt` = now ISO); rejects on non-2xx; `searchLocations('Kyo','en')` requests `https://geocoding-api.open-meteo.com/v1/search?name=Kyo&count=5&language=en&format=json`, maps results to `Location` with `name` "Kyoto, Japan" (adds `admin1` — "Name, Region, Country" — only when two results would share "Name, Country"), returns `[]` when `results` is missing
- [X] T014 Implement `apps/web/src/adapters/openMeteoWeatherService.ts` (`OpenMeteoWeatherService implements WeatherService`); make T013 pass
- [X] T015 Wire services: add `weather: WeatherService` and `store: KeyValueStore` to `Services` in `apps/web/src/state/services.tsx`, construct `OpenMeteoWeatherService` and the localStorage store in `apps/web/src/main.tsx`, and add a fake `WeatherService` to the test services used by `apps/web/tests/setup.ts`

**Checkpoint**: Migration applied, trips can store a location, forecasts can be fetched — user stories can begin

---

## Phase 3: User Story 1 - See the weather for each block at a glance (Priority: P1) 🎯 MVP

**Goal**: Every in-range cell shows a corner weather icon for that day at that block's time window; empty states are explained; block windows have defaults and can be edited.

**Independent Test**: With a trip location set directly (T002 helper) and the forecast fixture mocked, open a trip starting today: in-range cells show icons, Morning (sun) and Afternoon (rain) differ, out-of-range days show "Forecast from <date>", and with the API failing a "Weather unavailable" banner shows while editing still works.

### Tests for User Story 1 ⚠️

> Write these first; they must fail before implementation.

- [X] T016 [P] [US1] Tests for `conditionFromWmo` in `packages/core/tests/weather-wmo.test.ts`: "0–1 clear; 2 partly cloudy; 3 cloudy; 45, 48 fog; 51–67, 80–82 rain (drizzle included); 71–77, 85–86 snow; 95–99 thunderstorm" (research R6); unknown code → `cloudy`
- [X] T017 [P] [US1] Tests for `summarizeWindow(forecast, date, window)` in `packages/core/tests/weather-summarize.test.ts`: hours `[start, end)`; most severe condition wins ("thunderstorm > snow > rain > fog > cloudy > partly cloudy > clear"); `rainPct` = max (null only if all null); `tempC` = rounded mean; window `23:00–02:00` uses 23:00 of `date` and 00:00–01:00 of the next date; a window shorter than an hour (e.g. 20:30–21:00) uses the 20:00 hour; returns `null` when no hours are in the data; `fetchedAt` copied from the forecast
- [X] T018 [P] [US1] Tests in `packages/core/tests/window.test.ts`: `createTrip` writes the default windows from data-model.md "Default windows" (Morning 360–480 … Night 1380–120); `effectiveWindow` returns the stored window, else the default for a case-insensitive default name ("lunch" → 720–840), else the suggestion "start = previous block's effective end (06:00 if first), end = start + 60 min (mod 1440)"; `addBlock('Tea', afterAfternoonId)` stores 960–1020; `moveBlock` and `renameBlock` do not change a stored window; `setBlockWindow` sets it, rejects 1440 / start = end with `INVALID_WINDOW`, unknown block with `NOT_FOUND`, and undo restores the previous window
- [X] T019 [P] [US1] Tests in `packages/core/tests/weather-status.test.ts`: `dayForecastStatus(state, date, today)` returns `no-location` with no trip/day location, `past` when date < today, `pending` with `availableFrom = date − 15 days` when date > today + 15, else `in-range` with the effective location; `forecastLocations(state, todayIn)` returns distinct in-range locations only (same coordinates rounded to 2 decimals + tz counted once); `todayIn('Asia/Tokyo', now)` returns the Tokyo calendar date
- [X] T020 [P] [US1] Tests in `packages/core/tests/weather-cache.test.ts` using a fake `WeatherService` and in-memory `KeyValueStore`: key = `lat.toFixed(2),lon.toFixed(2),tz`; `peek` returns cached data without fetching; `get` returns cache when `fetchedAt` is under 3 h old, fetches and stores when older or missing; two concurrent `get`s for one key make one fetch; at most 20 entries are kept (oldest `fetchedAt` evicted); corrupt JSON in the store is treated as missing; a rejected fetch propagates and leaves the old cache intact

### Implementation for User Story 1

- [X] T021 [P] [US1] Implement `conditionFromWmo` in `packages/core/src/weather/wmo.ts` (make T016 pass)
- [X] T022 [P] [US1] Implement `DEFAULT_BLOCK_WINDOWS`, `suggestedWindow`, and `effectiveWindow` in `packages/core/src/queries/window.ts`
- [X] T023 [US1] Write default windows in `createTrip` (`packages/core/src/commands/trip.ts`), store the suggested window in `addBlock`, and add `setBlockWindow(blockId, window)` (`packages/core/src/commands/block.ts`); make T018 pass
- [X] T024 [US1] Implement `summarizeWindow` in `packages/core/src/weather/summarize.ts` using `conditionFromWmo` (make T017 pass)
- [X] T025 [US1] Implement `todayIn(tz, now)` (via `Intl.DateTimeFormat`), `dayForecastStatus`, and `forecastLocations` in `packages/core/src/weather/status.ts` (make T019 pass)
- [X] T026 [US1] Implement `createForecastCache(service, store)` in `packages/core/src/weather/cache.ts` (store key prefix `weather:`; make T020 pass)
- [X] T027 [US1] Export `conditionFromWmo`, `summarizeWindow`, `dayForecastStatus`, `forecastLocations`, `todayIn`, `createForecastCache`, `DEFAULT_BLOCK_WINDOWS`, `effectiveWindow`, `setBlockWindow` from `packages/core/src/index.ts`
- [X] T028 [US1] Create `apps/web/src/state/useForecasts.ts`: given the trip state, compute `forecastLocations`, render `cache.peek()` results immediately, then call `cache.get()` for each (no awaiting in any edit path); re-check staleness every 15 minutes while mounted; expose `cellWeather(date, blockId): CellWeather | null`, `dayStatus(date)`, and `unavailable: boolean` (true when an in-range location has no cache and its fetch failed)
- [X] T029 [P] [US1] Create `apps/web/src/components/weather/WeatherIcon.tsx` + `WeatherIcon.module.css`: seven inline SVG icons (one per `WeatherCondition`), colored only with tokens from `apps/web/src/styles/tokens.css`; rendered as a `<button type="button">` with `aria-label` "<Block> weather: <Condition label>, <N>% chance of rain" (omit the rain part when `rainPct` is null)
- [X] T030 [US1] Render `WeatherIcon` in the top-right corner of `apps/web/src/components/grid/Cell.tsx` / `Cell.module.css` when `cellWeather` is non-null: own hit area, does not start a drag or steal focus from cell typing (stop pointer-down propagation on the button only); dimmed with the cell when greyed out
- [X] T031 [US1] In `apps/web/src/components/grid/DayHeader.tsx` show "Forecast from <date>" for `pending` days; in `apps/web/src/pages/TripPlanner.tsx` show one `Banner` "Weather unavailable" when `unavailable` is true, and pass `useForecasts` results down through `Grid.tsx`
- [X] T032 [US1] Add a time-window editor to block settings in `apps/web/src/components/grid/BlockLabel.tsx`: two `<input type="time">` fields labeled "Starts" and "Ends", prefilled from `effectiveWindow`, calling `setBlockWindow` through the trip store; show the `INVALID_WINDOW` message inline
- [X] T033 [P] [US1] Component test `apps/web/tests/WeatherIcon.test.tsx`: each condition renders a distinct icon and the expected `aria-label`; null `rainPct` omits the rain text
- [ ] T034 [US1] E2E `apps/web/e2e/weather.spec.ts` (US1 block): with `mockOpenMeteo('ok')` and `setTripLocationDirect`, Morning and Afternoon cells of day 1 show different icon labels (sun vs rain); a trip 3 months out shows "Forecast from"; days 16+ of a 21-day trip show "Forecast from"; with `mockOpenMeteo('fail')` and cleared storage, the banner shows and typing an event into a cell and dragging a placement still work; editing Lunch to 13:00–15:00 then undo restores 12:00–14:00

**Checkpoint**: US1 delivers icons per cell — usable MVP once a location exists (set via DB until US3)

---

## Phase 4: User Story 2 - See forecast details on hover or tap (Priority: P1)

**Goal**: Hover, tap, or keyboard focus on an icon shows condition, temperature, chance of rain, and forecast time.

**Independent Test**: With US1 icons on screen, hover one with a mouse, tap one at 360 px, and focus one with Tab; each shows condition, temperature in the locale's unit, chance of rain %, "Forecast as of HH:MM", and the Open-Meteo attribution.

### Tests for User Story 2 ⚠️

- [X] T035 [P] [US2] Tests in `packages/core/tests/weather-units.test.ts`: `temperatureUnit` returns `F` for `en-US`, `es-US`, `en-PR`, `en-GU`, `en-VI`, `en-AS`, `en-MP`, `en-LR`, `my-MM`, and `C` for `en-GB`, `ja-JP`, `en` (no region); `formatTemp(22, 'C')` → "22°C", `formatTemp(22, 'F')` → "72°F" (rounded)
- [X] T036 [US2] Extend `apps/web/tests/WeatherIcon.test.tsx`: popover opens on mouse hover after 150 ms, on keyboard focus, and on tap (pointer type touch); closes on Escape, blur, and outside tap; shows condition label, formatted temperature, "N% chance of rain", "Forecast as of HH:MM", and a link "Weather data by Open-Meteo.com"; popover content is referenced by `aria-describedby`

### Implementation for User Story 2

- [X] T037 [P] [US2] Implement `temperatureUnit` and `formatTemp` in `packages/core/src/weather/units.ts` and export them from `packages/core/src/index.ts` (make T035 pass)
- [X] T038 [P] [US2] Create a small `Popover` in `apps/web/src/components/ui/Popover.tsx` + `Popover.module.css` (anchored to a trigger, tokens only, rounded, Escape/outside-click to close, stays inside the viewport at 360 px)
- [X] T039 [US2] Wire the popover into `apps/web/src/components/weather/WeatherIcon.tsx`: open/close rules from T036; content = condition label, `formatTemp(tempC, temperatureUnit(navigator.language))`, chance of rain (or "Chance of rain unavailable"), "Forecast as of HH:MM" from `fetchedAt` in the viewer's local time, and the "Weather data by Open-Meteo.com" link to `https://open-meteo.com/` (research R1); make T036 pass
- [ ] T040 [US2] E2E in `apps/web/e2e/weather.spec.ts` (US2 block): mouse hover shows the popover with "70% chance of rain" on an Afternoon cell; at 360 px viewport a tap opens it and tapping elsewhere closes it; Tab to an icon opens it; with `locale: 'en-US'` the temperature ends in °F and with `en-GB` in °C

**Checkpoint**: US1 + US2 — icons and details work with a DB-set location

---

## Phase 5: User Story 3 - Set where the trip is (Priority: P1)

**Goal**: The traveler searches for and sets a trip location, and can override it per day for multi-city trips.

**Independent Test**: Set the trip location to Kyoto via search → icons appear; override Day 4 to Osaka → "📍 Osaka" badge and only Day 4 changes; change the trip to Sapporo → Day 4 keeps Osaka; "Use trip location" clears the override; undo reverses each step.

### Tests for User Story 3 ⚠️

- [X] T041 [P] [US3] Tests in `packages/core/tests/day-location.test.ts`: `setDayLocation(date, loc)` creates a `day_settings` row with null arrival/departure and the location; `setDayLocation(date, null)` deletes the row when arrival and departure are null, otherwise keeps it with location cleared; date outside the trip → `DATE_OUT_OF_RANGE`; invalid location → `INVALID_LOCATION`; `setTripLocation` does not change day overrides; regression for research R4: `setDayWindow(date, null, null)` on a day with a location override keeps the row and its location, and `setDayWindow(date, a, d)` preserves an existing override; `removeBlock` of a day's arrival block keeps the row when it has a location override; undo restores each prior state exactly
- [X] T042 [P] [US3] Component test `apps/web/tests/LocationPicker.test.tsx` with a fake `WeatherService`: no search under 2 characters; search debounced 300 ms; up to 5 options with "Name, Region, Country"; ArrowDown/Enter selects and calls `onSelect(location)`; Escape closes; empty result shows "No matching place found" and does not call `onSelect`; fetch error shows "Couldn't search places right now"; combobox roles (`combobox`, `listbox`, `option`, `aria-activedescendant`)

### Implementation for User Story 3

- [X] T043 [US3] Implement `setDayLocation` in `packages/core/src/commands/location.ts`; change `setDayWindow` in `packages/core/src/commands/daySetting.ts` to keep the existing row's location fields and only delete the row when arrival, departure, and location are all null; change `clearBlockFromSettings` in `packages/core/src/commands/block.ts` to keep rows that still have a location; export `setDayLocation`; make T041 pass and confirm 001 tests (`day-window.test.ts`, `block.test.ts`) still pass
- [X] T044 [P] [US3] Create `apps/web/src/components/weather/LocationPicker.tsx` + `LocationPicker.module.css` per research R10 (WAI-ARIA combobox; uses `weather.searchLocations(query, navigator.language.split('-')[0])`); make T042 pass
- [X] T045 [US3] In `apps/web/src/pages/TripPlanner.tsx`, add a trip location control in the trip header (shows "📍 <name>" or "Add a location"; opens `LocationPicker`; has "Remove location") calling `setTripLocation` through the trip store; when no location is set, show a gentle prompt "Add a location to see the weather" (FR-003) instead of icons
- [X] T046 [US3] In `apps/web/src/components/grid/DayHeader.tsx` + `DayHeader.module.css`, show a "📍 <name>" badge when `dayLocationOverride` is set, and add day-menu actions "Set location for this day" (opens `LocationPicker`, calls `setDayLocation`) and "Use trip location" (calls `setDayLocation(date, null)`, shown only when an override exists)
- [ ] T047 [US3] E2E in `apps/web/e2e/weather.spec.ts` (US3 block): no location → prompt and no icons; search "Kyo" → pick "Kyoto, Japan" → icons appear; Day 4 → Osaka shows badge; trip → Sapporo keeps Day 4 Osaka; "Use trip location" clears it; three undos reverse the last three steps; "zzzxqq" shows "No matching place found" and keeps the location; intercepted Open-Meteo requests contain only `latitude`/`longitude` (forecast) or `name` (geocoding) beyond fixed params (FR-012)
- [ ] T048 [US3] Add a sync check to `apps/web/e2e/sync.spec.ts`: setting the trip location in one browser context shows the same location and icons in a second context within 5 s

**Checkpoint**: All three stories work end to end

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T049 [P] Extend `apps/web/e2e/a11y.spec.ts`: axe scan with weather icons visible, with a popover open, and with the `LocationPicker` open — no violations
- [X] T050 [P] In `README.md`, add a short "Weather" line to the intro (per-block forecast icons) and a new "## Integrations" section listing Open-Meteo: purpose, no API key, free non-commercial tier (10k calls/day), fallback ("Weather unavailable"), and CC BY 4.0 attribution; link `specs/002-weather-forecast/quickstart.md` next to the 001 quickstart link
- [ ] T051 Run `pnpm lint` (including the design-token stylelint rule), `pnpm --filter @cellar/core test`, `pnpm test:db`, `pnpm --filter web test`, `pnpm --filter web e2e`; fix any failures
- [ ] T052 Walk through all 22 scenarios in `specs/002-weather-forecast/quickstart.md` against the running app and note any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup — blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after US1 (the popover hangs off the US1 icon)
- **US3 (Phase 5)**: after Foundational; independent of US1/US2 for the picker and core, but its e2e (T047) checks icons, so run it after US1
- **Polish (Phase 6)**: after all stories

### Within Each Phase

- Tests before the implementation that makes them pass (T009→T010, T013→T014, T016–T020→T021–T026, T035→T037, T036→T039, T041→T043, T042→T044)
- Core before web: T027 before T028–T032; T043 before T045–T046
- T007 right after T005 so the build stays green

### Parallel Opportunities

- Phase 2: T004, T009, T012, T013 in parallel once T003/T005 are done
- US1 tests T016–T020 all in parallel; then T021 and T022 in parallel; T029 and T033 in parallel with core work
- US2: T035 and T038 in parallel
- US3: T041 and T042 in parallel; T044 in parallel with T043
- Polish: T049 and T050 in parallel

---

## Parallel Example: User Story 1

```bash
# All US1 core tests together:
Task: "Tests for conditionFromWmo in packages/core/tests/weather-wmo.test.ts"
Task: "Tests for summarizeWindow in packages/core/tests/weather-summarize.test.ts"
Task: "Tests for windows in packages/core/tests/window.test.ts"
Task: "Tests for dayForecastStatus in packages/core/tests/weather-status.test.ts"
Task: "Tests for createForecastCache in packages/core/tests/weather-cache.test.ts"

# Then independent implementations:
Task: "Implement conditionFromWmo in packages/core/src/weather/wmo.ts"
Task: "Implement effectiveWindow in packages/core/src/queries/window.ts"
Task: "Create WeatherIcon in apps/web/src/components/weather/WeatherIcon.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2
2. Phase 3 (US1) — set a location via DB to see icons
3. **Stop and validate** with T034 and quickstart scenarios 2, 3, 7, 12–18

### Incremental Delivery

1. US1 → icons on the grid
2. US2 → hover/tap details (the percentage-of-rain the user asked for)
3. US3 → location picker and per-day overrides — the feature is usable without DB access
4. Polish → a11y, README, full quickstart

US1–US3 are all P1; the feature ships when all three are done. Merge `feature/002-weather-forecast` into `main` only after Phase 6.

---

## Notes

- [P] = different files, no dependency on unfinished tasks
- Weather data is never part of undo history or synced; only location and window fields are
- Commit after each task or logical group
