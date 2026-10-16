# Cellar

A block-based vacation planner. Lay out a trip on a grid of days × time blocks (Morning,
Lunch, Afternoon, …), type events straight into cells or drag them in from a per-trip list of
activities and food places, customize the blocks, mark arrival/departure days, and undo freely.
Items can be linked to real places while you type, and opened in Google Maps, Apple Maps or
Waze. A Popular tab suggests well-known things to do and places to eat in the trip's city, ready
to drag onto the schedule. Trip cards and the trip page show a photo of the city, and Popular cards
show photos of the places. Trips sync across your devices. Each block shows a weather forecast icon for its time window,
with details on hover or tap.

- `packages/core` — platform-agnostic domain logic (commands, queries, undo/redo, merge)
- `apps/web` — React + Vite web app
- `supabase` — Postgres schema, row-level security, RPCs, and DB tests

Setup, automated checks and manual validation scenarios:
[specs/001-block-trip-planner/quickstart.md](specs/001-block-trip-planner/quickstart.md) and
[specs/002-weather-forecast/quickstart.md](specs/002-weather-forecast/quickstart.md), and
[specs/004-map-locations/quickstart.md](specs/004-map-locations/quickstart.md), and
[specs/006-popular-places/quickstart.md](specs/006-popular-places/quickstart.md), and
[specs/007-trip-photos/quickstart.md](specs/007-trip-photos/quickstart.md).

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

  The **Popular** tab of the item panel uses the same function and key (the `popular` action):
  Google **Text Search**, two requests (things to do, food) per city per browser session. Because
  the fields include rating and review count, these requests are billed in the Text Search
  **Enterprise** tier, with 1,000 free requests per month (check Google's current pricing). Also
  set a daily quota cap on Text Search as a cost backstop, for example about 100 per day. Google's
  terms do not allow storing place details, so popular results are kept in memory for the session
  only (never in local storage or the database) and are fetched again after a reload. Only the
  city name and its coordinates are sent. After updating, restart `supabase functions serve places`
  so the running function picks up the new action. Setup details:
  [specs/006-popular-places/quickstart.md](specs/006-popular-places/quickstart.md).

- **Trip photos.**
  - **City photos** (trip cards, the trip page banner, the cover picker) come from Wikipedia and
    Wikimedia Commons through their public API, called from the browser. It is free, needs no
    key, and the photos are openly licensed, so each one is credited ("Photo: author · license",
    linked to its Commons page). Lookups are cached on the device for 7 days. Only the city name
    is sent. The cover you pick is saved with the trip (Commons file name only, migration
    `0009_cover_photo.sql`; apply it locally with `supabase migration up --local`, no reset
    needed). If Wikimedia is unreachable, cards show a placeholder.
  - **Place photos** (Popular thumbnails and the detail view) come from Google through the same
    `places` function. The photo names ride along in the Popular Text Search (already the
    Enterprise tier, no extra charge); the new `photo` action turns a name into a short-lived
    image URL. **Place Details Photos** is billed as an Enterprise SKU: 1,000 free requests per
    month, then $7 per 1,000. Thumbnails are requested only for cards in view and the detail view
    asks for one large photo, so normal personal use (about 110 Popular visits a month) stays
    free. Set a daily quota cap of about 60 on **Place Photos** as a cost backstop. Google's
    terms do not allow caching photo names, so names and image URLs live in memory for the
    session only (never in local storage or the database), and the authors are credited under the
    photo and in the Popular list footer. After updating, restart
    `supabase functions serve places` so the running function picks up the `photo` action and
    the photo field in `popular`.
