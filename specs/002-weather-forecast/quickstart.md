# Quickstart & Validation: Weather Forecast on the Schedule

How to run the feature locally and prove it meets the [spec](./spec.md). Setup is the same as
[001 quickstart](../001-block-trip-planner/quickstart.md); weather needs no API key or new env
var (research R1).

## Setup

```bash
pnpm install
supabase start && supabase db reset     # applies 0006_weather.sql
pnpm --filter web dev                   # http://localhost:5173 (needs internet for Open-Meteo)
```

## Automated checks

```bash
pnpm --filter @cellar/core test   # summarizeWindow, windows, location commands, status (research R12)
pnpm test:db                      # new column constraints
pnpm --filter web test            # Open-Meteo adapter (mocked fetch), cache, WeatherIcon, LocationPicker
pnpm --filter web e2e             # scenarios below with Open-Meteo routes mocked by fixtures
pnpm lint
```

All must pass before merge.

## Manual validation scenarios

Use a trip whose dates start today or tomorrow unless noted.

| # | Steps | Expected | Spec |
|---|---|---|---|
| 1 | Open a trip with no location | No weather icons; a prompt offers "Add a location" | FR-003, US3-1 |
| 2 | Search "Kyo", pick "Kyoto, Japan" | Every in-range cell gets a corner icon within a few seconds | FR-001, US1-1, US3-2, SC-005 |
| 3 | Compare Morning vs Afternoon on a day with mixed weather (or the mocked fixture in e2e) | Different icons | US1-2 |
| 4 | Hover an icon with the mouse | Popover: condition, temperature, chance of rain %, "Forecast as of HH:MM" | FR-008, US2-1, SC-002 |
| 5 | At 360 px width, tap an icon; tap elsewhere | Popover opens, then closes | US2-2 |
| 6 | Tab to an icon with the keyboard; use a screen reader | Popover shows; label like "Afternoon weather: Light rain, 60% chance of rain" is announced | US2-3, constitution II |
| 7 | Drag a placement onto a cell, type into a cell, both near the icon | Drag and typing work normally; icon does not interfere | US1-4 |
| 8 | Open Day 4's header menu, set location "Osaka" | Day 4 shows "📍 Osaka" and different icons; other days unchanged | FR-001a, US3-5 |
| 9 | Change trip location to "Sapporo" | Day 4 keeps Osaka; other days switch to Sapporo | US3-7 |
| 10 | On Day 4 choose "Use trip location" | Badge disappears; Day 4 shows Sapporo | US3-6 |
| 11 | Undo three times | Steps 10, 9, 8 reversed, forecasts follow | FR-002, US3-4 |
| 12 | Open block settings for "Lunch", change window to 13:00–15:00 | Lunch icons may change; undo restores 12:00–14:00 | FR-006a |
| 13 | Add block "Tea" after "Afternoon" | Tea gets 16:00–17:00 and an icon; reordering Tea does not change its window | FR-006a, edge cases |
| 14 | Create a trip 3 months from now with a location | No icons; each day header shows "Forecast from <date>" | FR-007, edge cases |
| 15 | Trip spanning today … today + 20 | Days 0–15 show icons; days 16–20 show "Forecast from" | edge cases |
| 16 | Block Open-Meteo (DevTools → block request URL `api.open-meteo.com`) and clear site data, reload | Grid fully usable; one "Weather unavailable" banner; no icons | FR-011, SC-004 |
| 17 | With a cached forecast, block Open-Meteo, reload | Icons appear within 1 s with the old "Forecast as of" time | FR-010, SC-003 |
| 18 | Set Day 1 arrival to Lunch | Greyed cells still show icons, dimmed | edge cases |
| 19 | Browser language `en-US` vs `en-GB` | °F vs °C in the popover | FR-009 |
| 20 | Search "zzzxqq" | "No matching place found"; previous location kept | edge cases |
| 21 | In DevTools Network, inspect Open-Meteo requests | Only latitude/longitude (forecast) or the search text (geocoding) are sent | FR-012 |
| 22 | Edit location on device A, open the trip on device B | Same location and forecasts on B within 5 s | FR-002 |
