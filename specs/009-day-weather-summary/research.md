# Research: Day Weather Summary

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1. Data source

- **Decision**: Reuse the hourly `Forecast` already loaded for the day's location by
  `useForecasts` (feature 002). A new pure core function `summarizeDay(forecast, date)` reads the
  hours `<date>T07:00` … `<date>T21:00` (local to the location, as the forecast times already are).
- **Rationale**: FR-007 (no extra requests) and constitution III (logic in core). The same
  in-range / day-location rules as the cell icons apply because `useForecasts` already resolves
  them per date.

## R2. Hour classification

Each daytime hour gets a condition from the existing `conditionFromWmo` and is **wet** when its
condition is rain, snow or thunderstorm, or its `rainPct` is 50 or more (FR-003).

Parts of day: **AM** 07–11, **PM** 12–17, **evening** 18–21 (FR-002). A part is wet when any of
its hours is wet. A wet part's **kind** is storms if any hour is a thunderstorm, else snow if any
hour is snow, else rain. Its **weight** is "rain" when it has 3 or more wet hours or any heavy
code (63, 65, 67, 81, 82), else "showers" (light/short).

The **dry base** is the most common condition among dry hours, mapped to a word: clear →
Sunny, partly-cloudy → Partly cloudy, cloudy → Cloudy, fog → Fog. Ties go to the earlier hour's
condition.

## R3. Phrase rules (applied in order; first match wins)

| # | When | Phrase |
|---|---|---|
| 1 | Wet in all three parts, or ≥ 60% of daytime hours wet | "{Kind} all day" (Rain / Showers / Snow / Storms; Rain vs Showers by weight) |
| 2 | Wet AM only | "{Kind}, clearing PM" (e.g. "Rain, clearing PM", "Showers, clearing PM") |
| 3 | Wet AM and PM, dry evening | "{Kind} until evening" |
| 4 | Wet AM and evening, dry PM | "{Kind} on and off" |
| 5 | Wet PM (and maybe evening), dry AM | "{Base}, PM {kind}" (e.g. "Cloudy, PM showers", "Sunny, PM storms", "Cloudy, PM rain") |
| 6 | Wet evening only | "{Base}, evening {kind}" |
| 7 | Dry; fog in 2+ AM hours and not most of the day | "Fog early, then {base of PM+evening, lowercase}" |
| 8 | Dry; one condition in ≥ 80% of daytime hours | "{Base} all day" ("Sunny all day", "Cloudy all day"); for partly cloudy just "Partly cloudy" |
| 9 | Dry otherwise | "Mostly {base}" for Sunny/Cloudy, else "{Base}" |

Lowercase kinds in phrases: rain, showers, snow, storms.

**Length (FR-001, ≤ 24 chars)**: if a phrase is longer, drop the "{Base}, " prefix and capitalize
the rest ("Partly cloudy, evening showers" → "Evening showers"). Rule 7 falls back to "Fog early".

Hours missing from the forecast are ignored; with fewer than 8 daytime hours available the
summary is `null` (no phrase; e.g. partial last forecast day).

## R4. Details on demand

`high` / `low` = max / min daytime `tempC`; `rainPct` = max daytime `rainPct` (null when none).
Shown in a popover like the cell `WeatherIcon` (hover, focus, tap), with temperatures through the
existing `temperatureUnit` / `formatTemp` and "Forecast as of HH:MM" from `fetchedAt`.

## R5. Header layout

Second line of `DayHeader` holds the phrase as a button (opens the detail popover), truncated
with an ellipsis and a `title` with the full phrase. When the day also has arrival / departure /
city indicators, they render icon-only (`role="img"`, `aria-label` = their full text, tooltip)
before the phrase; days without a phrase keep the full labels (clarification). The existing
layout test (≤ 2 lines) covers it.

## R6. Testing

- Core: a table test with hand-built forecasts for every rule (R3) plus the length fallback,
  missing hours, the 50% threshold, heavy vs light, overnight-only rain (not counted), and
  high/low/rain values.
- Web: `DayHeader` shows the phrase, icon-only indicators with names when a phrase exists, full
  labels otherwise, popover details; `useForecasts` exposes `daySummary(date)` only for in-range
  days.
- E2E: with the Open-Meteo fixture (sunny mornings, rain 14–18), headers read "Sunny, PM rain";
  layout test stays at two lines; axe light/dark.
