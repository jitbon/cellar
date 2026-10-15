# Cellar

A block-based vacation planner. Lay out a trip on a grid of days × time blocks (Morning,
Lunch, Afternoon, …), type events straight into cells or drag them in from a per-trip list of
activities and food places, customize the blocks, mark arrival/departure days, and undo freely.
Items can be linked to real places while you type, and opened in Google Maps, Apple Maps or
Waze. Trips sync across your devices. Each block shows a weather forecast icon for its time window,
with details on hover or tap.

- `packages/core` — platform-agnostic domain logic (commands, queries, undo/redo, merge)
- `apps/web` — React + Vite web app
- `supabase` — Postgres schema, row-level security, RPCs, and DB tests

Setup, automated checks and manual validation scenarios:
[specs/001-block-trip-planner/quickstart.md](specs/001-block-trip-planner/quickstart.md) and
[specs/002-weather-forecast/quickstart.md](specs/002-weather-forecast/quickstart.md), and
[specs/004-map-locations/quickstart.md](specs/004-map-locations/quickstart.md).

## Integrations

- **Open-Meteo** ([open-meteo.com](https://open-meteo.com)) provides the weather forecast and
  place search. No API key is needed. The free tier is for non-commercial use, up to 10,000
  calls per day. If it fails or is rate-limited, the last cached forecast is shown; with none, the
  grid shows a "Weather unavailable" banner and keeps working. Data is CC BY 4.0, credited in the
  forecast popover.
- **Google Places API (New)** provides the place suggestions shown while typing an item name
  (Autocomplete, then one Place Details call when a suggestion is picked). The key lives only in
  a Supabase Edge Function (`supabase/functions/places`), never in the browser. If the key is
  missing, the quota is hit, or Google fails, the name field shows "Place search unavailable" and
  items are saved as plain text; "Open in maps" keeps working from the saved place. Setup:
  1. In Google Cloud, enable **Places API (New)** and create a server API key restricted to
     that API only.
  2. Set daily quota caps on the project as a cost backstop, for example 1,000 Autocomplete and
     300 Place Details requests per day (Autocomplete sessions that end in a Place Details call
     are free; personal use stays within the free monthly caps).
  3. Store the key as a secret and deploy the function:
     `supabase secrets set GOOGLE_PLACES_API_KEY=<your key>` then
     `supabase functions deploy places`.
  4. Locally, copy `supabase/functions/.env.example` to `supabase/functions/.env` (gitignored),
     fill in the key, and run `supabase functions serve places`.
  5. CORS is limited to the origins in `ALLOWED_ORIGINS` (comma-separated, default
     `http://localhost:5173`). Add each origin the app is served from, for example
     `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5199` locally, or set it for the
     deployed function with `supabase secrets set ALLOWED_ORIGINS=https://your-app.example`.

  Only the typed text, an anonymous session token and the trip's coordinates are sent. Results
  are shown with "Powered by Google".
