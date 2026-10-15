# Implementation Plan: Weather Forecast on the Schedule

**Branch**: `feature/002-weather-forecast` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-weather-forecast/spec.md`

## Summary

Each schedule cell shows a small weather icon in its corner for that day at that block's time
of day; hovering, tapping, or focusing it shows condition, temperature, chance of rain, and
"Forecast as of HH:MM". Forecasts use the trip's location, which any day can override for
multi-city trips. Each block gets an editable time window (defaults such as Lunch 12–14).

Technical approach: location and block-window fields are added as plain columns on `trips`,
`day_settings`, and `blocks`, so they save, sync, merge, and undo through the existing 001
pipeline. Core gains pure commands/queries (location, windows, forecast status, hourly → cell
summary) and two ports (`WeatherService`, `KeyValueStore`). The web app implements them with
Open-Meteo (no API key) and `localStorage`, caching forecasts per device for 3 h
([research.md](./research.md)).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS for tooling (unchanged)

**Primary Dependencies**: Unchanged from 001 (React 19, Vite, supabase-js v2, dnd-kit). New
external service: Open-Meteo Forecast + Geocoding APIs over `fetch`. No new npm packages.

**Storage**: Supabase Postgres — new nullable columns (migration `0006_weather.sql`,
[contracts/database.md](./contracts/database.md)); forecasts cached per device in
`localStorage` via the `KeyValueStore` port; never stored server-side

**Testing**: Vitest (core, web, DB), Playwright (e2e with Open-Meteo routes mocked)

**Target Platform**: Evergreen desktop and mobile browsers; core reusable by the future mobile app

**Project Type**: Web application (existing pnpm monorepo: `packages/core`, `apps/web`, `supabase`)

**Performance Goals**: Cached icons render ≤ 1 s after opening a trip (SC-003); weather never
delays a planning action (FR-011); a 60-day trip needs at most one forecast request per distinct
in-range location

**Constraints**: No API keys in client (none needed); only coordinates/search text sent to the
provider (FR-012); WCAG 2.1 AA; usable at 360 px; design tokens only; Open-Meteo free tier
(non-commercial, 10k calls/day)

**Scale/Scope**: Personal use; ≤ ~5 distinct locations per trip; ~3 new UI pieces
(`WeatherIcon` + popover, `LocationPicker`, block window editor)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Pre | Post |
|---|---|---|---|
| I. Flexible block-based planning | Windows are editable per block and never restrict placement (FR-006a); location and window edits are undoable commands; weather never blocks editing | ✅ | ✅ |
| II. Clean, friendly interface | Condition shown by icon + `aria-label`/popover text, never color alone (Q1 clarification); popover reachable by mouse, touch, and keyboard (R11); tokens only; 360 px scenario in quickstart | ✅ | ✅ |
| III. Portable core | All weather logic (WMO mapping, summarizing, status, windows, cache policy) in `packages/core`; network and storage only behind `WeatherService` / `KeyValueStore` ports | ✅ | ✅ |
| IV. Integrations behind adapters | Open-Meteo only in `openMeteoWeatherService.ts`; no key; failures degrade to "Weather unavailable" (R8); cached and labeled "Forecast as of" (R7, R11); cost/quota/fallback documented (R1) | ✅ | ✅ |
| V. Simplicity & verified changes | No proxy, no server cache, no new npm deps, no backfill; core unit tests listed (R12) | ✅ | ✅ |
| Constraints: location & data minimization | Location is typed by the traveler, never device geolocation; only lat/lon or search text leave the device (FR-012) | ✅ | ✅ |
| Workflow | specify → clarify (3 Qs) → plan; on feature branch | ✅ | ✅ |

No violations. Post-design note: the `day_settings` row-lifecycle change (R4) touches existing
001 commands (`setDayWindow`, `removeBlock`); covered by regression tests.

## Project Structure

### Documentation (this feature)

```text
specs/002-weather-forecast/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── core.md          # new core types, commands, queries, ports
│   └── database.md      # migration 0006 columns + constraints
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
packages/core/
├── src/
│   ├── model/types.ts            # + LocationFields, window fields, weather types
│   ├── model/validation.ts       # + validateLocation, validateWindow
│   ├── commands/location.ts      # NEW setTripLocation, setDayLocation
│   ├── commands/block.ts         # + setBlockWindow; addBlock writes suggested window
│   ├── commands/trip.ts          # createTrip writes default windows
│   ├── commands/daySetting.ts    # row kept while location override set
│   ├── queries/location.ts       # NEW tripLocation, dayLocation, dayLocationOverride
│   ├── queries/window.ts         # NEW effectiveWindow, DEFAULT_BLOCK_WINDOWS
│   ├── weather/                  # NEW wmo.ts, summarize.ts, status.ts, units.ts, cache.ts
│   ├── ports.ts                  # + WeatherService, KeyValueStore
│   └── index.ts
└── tests/                        # + location, window, weather-* tests

apps/web/src/
├── adapters/openMeteoWeatherService.ts   # NEW
├── adapters/localStorageStore.ts         # NEW
├── state/services.tsx                    # + weather, store
├── state/useForecasts.ts                 # NEW: peek cache, refresh stale, expose per-cell weather
├── components/weather/WeatherIcon.tsx    # NEW icon button + popover (+ .module.css)
├── components/weather/LocationPicker.tsx # NEW combobox (+ .module.css)
├── components/grid/Cell.tsx              # renders WeatherIcon in corner
├── components/grid/DayHeader.tsx         # "📍 override" badge, "Forecast from", location menu
├── components/grid/BlockLabel.tsx        # window editor in block settings
└── pages/TripPlanner.tsx                 # trip location control, "Weather unavailable" banner

supabase/migrations/0006_weather.sql      # NEW
supabase/tests/                           # + constraint tests
```

**Structure Decision**: Same monorepo layout as 001. Weather logic lives in a new
`packages/core/src/weather/` folder; the only network code is one web adapter.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Client-side forecast cache with staleness (R7) | Constitution IV requires caching; SC-003 needs icons on reload within 1 s | In-memory only loses forecasts on reload; server cache needs a table + RLS + function |
| Derived windows for legacy blocks (R5) | Existing trips get weather without a data backfill | SQL backfill of custom blocks needs recursive position logic |
