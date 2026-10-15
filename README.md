# Cellar

A block-based vacation planner. Lay out a trip on a grid of days × time blocks (Morning,
Lunch, Afternoon, …), type events straight into cells or drag them in from a per-trip list of
activities and food places, customize the blocks, mark arrival/departure days, and undo freely.
Trips sync across your devices. Each block shows a weather forecast icon for its time window,
with details on hover or tap.

- `packages/core` — platform-agnostic domain logic (commands, queries, undo/redo, merge)
- `apps/web` — React + Vite web app
- `supabase` — Postgres schema, row-level security, RPCs, and DB tests

Setup, automated checks and manual validation scenarios:
[specs/001-block-trip-planner/quickstart.md](specs/001-block-trip-planner/quickstart.md) and
[specs/002-weather-forecast/quickstart.md](specs/002-weather-forecast/quickstart.md).

## Integrations

- **Open-Meteo** ([open-meteo.com](https://open-meteo.com)) provides the weather forecast and
  place search. No API key is needed. The free tier is for non-commercial use, up to 10,000
  calls per day. If it fails or is rate-limited, the last cached forecast is shown; with none, the
  grid shows a "Weather unavailable" banner and keeps working. Data is CC BY 4.0, credited in the
  forecast popover.
