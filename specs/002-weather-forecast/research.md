# Research: Weather Forecast on the Schedule

Decisions for [plan.md](./plan.md). The stack from 001 (TypeScript core, React + Vite web app,
Supabase) is unchanged; only what this feature adds is decided here.

## R1. Weather provider

- **Decision**: [Open-Meteo](https://open-meteo.com) — Forecast API
  (`api.open-meteo.com/v1/forecast`) and Geocoding API (`geocoding-api.open-meteo.com/v1/search`).
- **Rationale**: No API key (nothing secret to keep out of the client, constitution IV); CORS
  enabled; hourly `weather_code` (WMO), `temperature_2m`, and `precipitation_probability` for up
  to 16 days; `timezone=auto` returns hours in the location's local time (spec assumption); the
  geocoder returns coordinates and IANA time zone in one call. Free for non-commercial use up to
  10,000 calls/day, far above this app's need (≈ one call per location per 3 h per device).
- **Alternatives considered**: OpenWeatherMap, WeatherAPI.com, Tomorrow.io — all need an API key,
  so they would require a server-side proxy just to hide it. US National Weather Service — US
  only.
- **Cost / quota / fallback** (constitution, Technology & Integration Constraints): free tier,
  10k calls/day, no SLA. If the API fails or is rate-limited, the last cached forecast is shown
  with its fetch time; with no cache, cells show no icon and a "Weather unavailable" banner (R8).
  If the app ever becomes commercial, swap in a paid Open-Meteo key behind a Supabase Edge
  Function proxy — only the adapter changes.

## R2. Calling the provider: client or server

- **Decision**: The web app calls Open-Meteo directly, through a `WeatherService` port defined in
  core and implemented by `apps/web/src/adapters/openMeteoWeatherService.ts`.
- **Rationale**: No key to hide, so a proxy adds a deployable piece with no benefit (constitution
  V). Only latitude, longitude, and the search text leave the device (FR-012).
- **Alternatives considered**: Supabase Edge Function proxy with a shared server-side cache —
  saves calls across devices, but adds a function, a cache table, and deployment for a
  single-user app. Revisit if quota becomes a problem.

## R3. Where locations are stored

- **Decision**: Flat nullable columns on existing tables: `trips.location_name`,
  `location_lat`, `location_lon`, `location_tz`, and the same four on `day_settings` for the
  per-day override. All four are null or all are set (check constraint).
- **Rationale**: The repository maps columns generically (camelCase ↔ snake_case), so save, sync,
  realtime, merge, and undo work with no adapter changes. A location belongs to exactly one
  trip/day and is never shared, so a separate `locations` table would only add joins.
- **Alternatives considered**: `jsonb location` column — hides fields from constraints and
  breaks per-field last-write-wins symmetry with other columns; separate table — unneeded.

## R4. Day settings row lifecycle

- **Decision**: A `day_settings` row exists while any of arrival, departure, or location
  override is set. `setDayWindow` and `removeBlock`'s cleanup currently delete the row when
  arrival and departure are both null; both change to also keep it when a location is set. A new
  `setDayLocation(date, location | null)` command follows the same rule.
- **Rationale**: Keeps one row per day (same primary key), so one day's settings sync as a unit.

## R5. Block time windows

- **Decision**: Two nullable integer columns on `blocks`: `window_start_min`,
  `window_end_min` (minutes after local midnight, 0–1439; end < start means it crosses midnight;
  start = end is rejected). Rules in core:
  - `createTrip` writes the default windows from spec FR-006 for the ten default blocks.
  - `addBlock` writes a **suggested** window at creation: start = previous block's effective end
    (06:00 if first), end = start + 1 h. Stored, so reordering or renaming never changes it
    (spec edge case).
  - `setBlockWindow(id, start, end)` edits it; undoable like other block edits.
  - `effectiveWindow(state, blockId)`: stored window, else (legacy blocks created before this
    feature) the default window if the name matches a default block name case-insensitively,
    else the suggestion rule from its current position. The first edit pins it.
- **Rationale**: Existing trips get sensible windows with no data backfill; new data is always
  explicit. Minutes are simpler than `time` columns for wrap-around math.
- **Alternatives considered**: `time` columns with a SQL backfill — custom-block backfill needs
  recursive position logic in SQL; derive all windows from position — violates "reordering does
  not change a block's window".

## R6. Turning hourly data into one icon per cell

- **Decision**: Pure core function `summarizeWindow(forecast, date, window)` over the hours
  `[start, end)` of that date (continuing into the next date when the window crosses midnight;
  a window shorter than one hour uses the hour it starts in):
  - **Condition**: most severe category among the hours, by severity
    thunderstorm > snow > rain > fog > cloudy > partly cloudy > clear — a planner cares that it
    *might* rain in the block.
  - **Chance of rain**: maximum `precipitation_probability` over the hours.
  - **Temperature**: rounded mean of `temperature_2m`.
  - WMO code mapping: 0–1 clear; 2 partly cloudy; 3 cloudy; 45, 48 fog; 51–67, 80–82 rain
    (drizzle included); 71–77, 85–86 snow; 95–99 thunderstorm.
  - Returns `null` if none of the hours are in the fetched data.
- **Rationale**: Deterministic and unit-testable in core (constitution III, V); the seven
  categories are exactly FR-005's list.
- **Alternatives considered**: most frequent condition — hides a one-hour storm; condition at the
  window's midpoint — same problem.

## R7. Caching and refresh

- **Decision**: Cache per device in a `KeyValueStore` port (web: `localStorage`, wrapped in
  try/catch). Key: coordinates rounded to 2 decimals (≈1 km) + time zone. Value: hourly arrays +
  `fetchedAt`. On opening a trip, cached forecasts render immediately (SC-003); if older than
  3 h, a background refresh runs and re-renders. At most 20 cache entries (oldest evicted). One
  in-flight request per key.
- **Rationale**: Meets FR-010 and SC-003 with no server work. Forecasts are not trip data, so
  they are never synced, never in undo history, and never written to Supabase.
- **Alternatives considered**: Supabase cache table shared by devices — extra table and RLS for
  little gain (R2); in-memory only — fails SC-003 on reload.

## R8. Forecast range and unavailable states

- **Decision**: Request `forecast_days=16`. In the location's time zone, a date is *in range* if
  today ≤ date ≤ today + 15. Per day, the grid shows one of:
  - in range with data → icons in cells;
  - future, out of range → no icons; day header shows "Forecast from <date − 15>";
  - past → nothing;
  - no location for that day → nothing (trip-level prompt to add one, FR-003);
  - fetch failed and no cache → nothing, plus one "Weather unavailable" banner (reuse `Banner`).
- **Rationale**: Every empty state is explained (spec edge cases) without per-cell noise.

## R9. Units

- **Decision**: Always fetch °C; core `temperatureUnit(locale)` returns `°F` when the locale's
  region is US, LR, MM, or a US territory (PR, GU, VI, AS, MP), else `°C`; web passes
  `navigator.language`.
- **Rationale**: FR-009 with no settings UI; conversion is one pure function.

## R10. Location search

- **Decision**: A `LocationPicker` combobox (WAI-ARIA combobox pattern): debounced 300 ms,
  minimum 2 characters, up to 5 results from the geocoder in the user's language. Each result
  shows "Name, Region, Country"; the stored `location_name` is "Name, Country" (adding the
  region only when two results would otherwise look the same). Used in the trip header (trip
  location) and in the day header menu (override, with "Use trip location" to clear).
- **Rationale**: FR-001/FR-001a; SC-005 (under 30 s). No results → "No matching place found",
  and the previous location is kept (spec edge case).

## R11. Icons and details popover

- **Decision**: Seven inline SVG icons in `WeatherIcon.tsx` (no icon dependency; matches how
  the app draws icons today), colored with existing tokens. The icon is a `<button>` in the
  cell's top-right corner with an `aria-label` such as "Afternoon weather: Light rain, 60%
  chance of rain". A small `Popover` opens on hover (mouse, after 150 ms), focus (keyboard), or
  tap (touch), closes on Escape, blur, or tap elsewhere, and shows condition, temperature, chance
  of rain, and "Forecast as of HH:MM" (FR-008, constitution IV labeling). The icon never
  intercepts drag or typing in the cell (its own hit area; `pointer-events` only on the
  button). Greyed cells show the icon dimmed with the cell.
- **Rationale**: Constitution II (icon, not color alone; keyboard; AA contrast), US1/US2.
- **Alternatives considered**: emoji — render differently per platform and cannot use tokens;
  icon library — a dependency for seven glyphs.

## R12. Testing

- **Decision**:
  - Core (Vitest): `summarizeWindow` (severity, max rain, mean temp, midnight wrap, missing
    hours), WMO mapping, `effectiveWindow` (stored/default-name/suggested), `addBlock`
    suggestion, `setBlockWindow` validation + undo, `setTripLocation` / `setDayLocation` + undo,
    day-settings row lifecycle, `forecastStatus` per day (in range / from date / past / no
    location), `temperatureUnit`.
  - Web (Vitest + Testing Library): `openMeteoWeatherService` and geocoder parsing with mocked
    `fetch`; cache freshness and eviction; `WeatherIcon` popover on hover/focus/tap and its
    `aria-label`; `LocationPicker` keyboard flow.
  - DB (Vitest vs local Supabase): new columns' check constraints; RLS unchanged for new columns.
  - E2E (Playwright): Open-Meteo routes mocked with fixtures; scenarios in
    [quickstart.md](./quickstart.md), including "weather API down".
