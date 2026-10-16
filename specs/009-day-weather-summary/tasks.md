---

description: "Task list for Day Weather Summary"
---

# Tasks: Day Weather Summary

**Input**: Design documents from `/specs/009-day-weather-summary/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/core.md, quickstart.md

**Tests**: Included. Constitution Principle V requires tests for core logic; research R6 lists
core, web and e2e tests. Tests are written first and must fail before the implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to (US1–US2)

## Path Conventions

Monorepo: `packages/core/`, `apps/web/`. Phrase rules: `research.md` R2–R3 (quote them when
implementing). Builds on feature 002: `Forecast`, `conditionFromWmo`, `summarizeWindow`,
`useForecasts`, `WeatherIcon` popover, `temperatureUnit`/`formatTemp`.

---

## Phase 1: Foundational (Blocking Prerequisites)

- [ ] T001 Add `DaySummary` and `summarizeDay(forecast, date)` to new `packages/core/src/weather/daySummary.ts` as a stub returning `null`, exported from `packages/core/src/index.ts` per contracts/core.md, so tests compile

---

## Phase 2: User Story 1 - See each day's weather in a few words (Priority: P1) 🎯 MVP

**Goal**: Each in-range day header shows a ≤ 24-character phrase on its second line.

**Independent Test**: Quickstart 1, 3–6.

### Tests for User Story 1

- [ ] T002 [P] [US1] Write a failing table test in `packages/core/tests/day-summary.test.ts` with a helper that builds a `Forecast` for one date from 15 hourly specs (07:00–21:00, each `{ code, rainPct }`), covering every rule in research R3 with the expected phrase: all clear → "Sunny all day"; all code 3 → "Cloudy all day"; mostly code 2 → "Partly cloudy"; 9 clear + 6 cloudy → "Mostly sunny"; rain (code 61) 07–11 then clear → "Rain, clearing PM"; one light shower hour at 08 (code 80) then clear → "Showers, clearing PM"; clear AM + 4 rain hours 14–17 → "Sunny, PM rain"; cloudy AM + one 60% hour at 15 → "Cloudy, PM showers"; thunderstorm (95) at 16 → "Sunny, PM storms"; rain in all three parts → "Rain all day"; snow (71) most hours → "Snow all day"; wet AM + PM, dry evening → "Rain until evening"; wet AM + evening, dry PM → "Showers on and off"; partly cloudy + evening showers → "Evening showers" (24-char fallback); fog (45) 07–09 then clear → "Fog early, then sunny"; rain only at 00–06 and 22–23 (outside daytime) → "Sunny all day"; 49% rain chance never counts as wet, 50% does; fewer than 8 daytime hours present → `null`. Also assert `highC`/`lowC` (rounded max/min daytime temps), `rainPct` (max daytime, `null` when all null) and `fetchedAt` passthrough, and that every phrase in the table is ≤ 24 characters
- [ ] T003 [P] [US1] Extend `apps/web/tests/DayHeader.test.tsx`: with a `summary` prop the header shows the phrase on its second line (as a button named "Weather for <date>: <phrase>"); with arrival/departure/city indicators AND a summary, the indicators render as `role="img"` icons whose accessible names are their full text ("Arrive · Lunch") and no visible label text; without a summary the full labels show as before; no summary → no weather button

### Implementation for User Story 1

- [ ] T004 [US1] Implement `summarizeDay` in `packages/core/src/weather/daySummary.ts` exactly per research R2–R3 (daytime 07:00–21:00; wet = rain/snow/thunderstorm condition or `rainPct >= 50`; parts AM 07–11, PM 12–17, evening 18–21; kind storms > snow > rain; weight "rain" when ≥ 3 wet hours or any code 63/65/67/81/82, else "showers"; dry base = most common dry condition, ties to the earlier hour; rules 1–9 in order; > 24 chars drops "{Base}, " and capitalizes; `null` with fewer than 8 daytime hours); make T002 pass
- [ ] T005 [US1] Add `daySummary(date)` to `Forecasts` in `apps/web/src/state/useForecasts.ts` (same day forecast and `in-range` check as `cellWeather`; `null` otherwise; `NONE` returns `null`); add a test in `apps/web/tests/useForecasts.test.tsx` (create if missing, or the closest existing hook test) for in-range vs pending/past/no-location days
- [ ] T006 [US1] In `apps/web/src/components/grid/DayHeader.tsx` (+ `.module.css`, tokens only): new optional `summary?: DaySummary | null` prop; second line shows icon-only indicators (when `summary`) then the phrase, single line with ellipsis and `title`; full labels when no summary; pass `forecasts.daySummary(d.date)` from `apps/web/src/components/grid/Grid.tsx`; make T003 pass
- [ ] T007 [US1] Add an e2e test to `apps/web/e2e/weather.spec.ts` (US1 block, `mockOpenMeteo(page, 'ok')`): a Kyoto trip starting today shows "Sunny, PM rain" in each in-range day header (fixture: clear 06–13, rain 70% 14–17, partly cloudy after); a day beyond today + 15 shows no phrase; a trip without a location shows none; with an arrival set the header is still two lines and the arrival is an icon named "Arrive · Lunch"

**Checkpoint**: Phrases show in day headers

---

## Phase 3: User Story 2 - More detail on demand (Priority: P2)

**Goal**: Hover/focus/tap on the phrase shows high/low, highest rain chance and forecast time.

**Independent Test**: Quickstart 2.

- [ ] T008 [P] [US2] Extend `apps/web/tests/DayHeader.test.tsx`: activating the phrase button (click and keyboard Enter/focus) opens a popover with "High 24° · Low 15°" in the locale's unit (Fahrenheit for en-US per `temperatureUnit`), "Rain up to 70%" (omitted when `rainPct` is null) and "Forecast as of HH:MM"; Escape closes it
- [ ] T009 [US2] Implement the popover in `DayHeader.tsx` reusing the `WeatherIcon` popover pattern (`apps/web/src/components/weather/WeatherIcon.tsx`: hover, focus and tap; same `Popover`), with `formatTemp`/`temperatureUnit`; make T008 pass
- [ ] T010 [US2] Add an e2e test in `apps/web/e2e/weather.spec.ts` (US2 block): hovering the phrase shows the high/low and "Forecast as of"; keyboard focus shows it too

---

## Phase 4: Polish & Cross-Cutting Concerns

- [ ] T011 [P] Extend `apps/web/e2e/layout.spec.ts` (SC-004 two-line test) to include a day with a phrase and an arrival, and a 360 px check that the phrase truncates on one line; add the phrase popover to the axe checks in `apps/web/e2e/a11y.spec.ts` (light and dark)
- [ ] T012 Run `pnpm lint`, `pnpm --filter web typecheck`, `pnpm test` and the e2e suite; fix failures
- [ ] T013 Walk through quickstart.md scenarios 1–7 against the live app (real Open-Meteo)

---

## Dependencies & Execution Order

- T001 → US1 → US2 → Polish. US2 builds on US1's header button.
- Parallel: T002 and T003; T008 alongside T007; T011 with T012 prep.

## Implementation Strategy

US1 alone is the MVP (phrases visible). US2 adds detail. Merge to `main` after the user confirms.
