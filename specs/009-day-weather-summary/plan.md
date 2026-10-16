# Implementation Plan: Day Weather Summary

**Branch**: `feature/009-day-weather-summary` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-day-weather-summary/spec.md`

## Summary

Each in-range day header shows a short weather phrase on its second line ("Sunny all day",
"Cloudy, PM showers", "Rain, clearing PM"), with high/low, rain chance and forecast time on
hover, focus or tap. On days that also have travel or city labels, those become icons beside the
phrase so headers stay two lines.

Technical approach: a pure core function `summarizeDay(forecast, date)` applies fixed phrase
rules to the daytime hours of the forecast feature 002 already loads ([research.md](./research.md)
R1–R3). `useForecasts` exposes it per date with the same location and in-range logic as the cell
icons, so there are no new requests. `DayHeader` renders it with a popover like `WeatherIcon`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict)

**Primary Dependencies**: Unchanged; no new services or packages

**Storage**: None (derived from the cached forecast)

**Testing**: Vitest (phrase table in core, header and hook in web), Playwright (Open-Meteo mocked)

**Target Platform**: Evergreen desktop and mobile browsers

**Project Type**: Web application (existing monorepo)

**Performance Goals**: Summaries appear with the cell icons (SC-003); no extra requests (FR-007)

**Constraints**: ≤ 24 characters; two-line headers; text not color; tokens only; 360 px

**Scale/Scope**: One core module, one hook method, one header change

## Constitution Check

| Principle | How this plan complies | Pre | Post |
|---|---|---|---|
| I. Flexible block-based planning | Display only; nothing blocks editing | ✅ | ✅ |
| II. Clean, friendly interface | Phrase is text; icon-only travel labels keep accessible names and tooltips; tokens; 360 px truncation with full text available | ✅ | ✅ |
| III. Portable core | Phrase rules in `packages/core/src/weather/daySummary.ts` | ✅ | ✅ |
| IV. Integrations behind adapters | Reuses the existing `WeatherService` forecast and its "Forecast as of" label; unavailable → no phrase | ✅ | ✅ |
| V. Simplicity & verified changes | No new services, storage or deps; table-driven core tests | ✅ | ✅ |

No violations.

## Project Structure

```text
specs/009-day-weather-summary/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/core.md
└── checklists/requirements.md

packages/core/src/weather/daySummary.ts    # NEW summarizeDay
packages/core/src/index.ts                 # export
packages/core/tests/day-summary.test.ts    # NEW phrase table
apps/web/src/state/useForecasts.ts         # + daySummary(date)
apps/web/src/components/grid/DayHeader.tsx # phrase line, icon-only indicators, popover
apps/web/src/components/grid/Grid.tsx      # pass the summary
apps/web/tests/DayHeader.test.tsx          # + phrase cases
apps/web/e2e/weather.spec.ts               # + header phrase scenario
```

## Complexity Tracking

No constitution violations to justify.
