# Cellar

A block-based vacation planner. Lay out a trip on a grid of days × time blocks (Morning,
Lunch, Afternoon, …), type events straight into cells or drag them in from a per-trip list of
activities and food places, customize the blocks, mark arrival/departure days, and undo freely.
Trips sync across your devices.

- `packages/core` — platform-agnostic domain logic (commands, queries, undo/redo, merge)
- `apps/web` — React + Vite web app
- `supabase` — Postgres schema, row-level security, RPCs, and DB tests

Setup, automated checks and manual validation scenarios:
[specs/001-block-trip-planner/quickstart.md](specs/001-block-trip-planner/quickstart.md).
