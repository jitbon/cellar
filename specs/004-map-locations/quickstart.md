# Quickstart: Map Locations for Items

How to prove the feature works. Contracts: [core](./contracts/core.md),
[database](./contracts/database.md), [places function](./contracts/places-function.md).

## Prerequisites

- Local Supabase running (`supabase start`) with migration `0007_places.sql` applied
  (`supabase db reset`).
- A Google Cloud project with **Places API (New)** enabled, a server API key restricted to
  that API, and daily quota caps set (research R1).
- `supabase/functions/.env` containing `GOOGLE_PLACES_API_KEY=…` (gitignored), then
  `supabase functions serve places`.
- Web app: `pnpm --filter web dev`, signed in, with a trip located in New York.

## Automated checks

```sh
pnpm test                          # core + web unit tests
pnpm test:db                       # DB constraint tests (place-columns) + places handler tests
pnpm --filter web e2e              # Playwright; places function mocked
pnpm lint && pnpm --filter web typecheck
```

All must pass. The e2e suite never calls Google.

## Manual scenarios

| # | Steps | Expected |
|---|---|---|
| 1 | Item panel → Add → type "Chelsea Mar", pause | ≤ 1 s: up to 5 places, Chelsea Market near the top, "Powered by Google" footer |
| 2 | Pick "Chelsea Market", Save | Item shows "Chelsea Market" + short address and a pin; type Activity |
| 3 | Add "Los Tacos No. 1", pick it | Type switches to Food |
| 4 | Add "Rest day", press Enter without picking | Plain item, no pin, no address |
| 5 | Grid cell → type "katz", pick Katz's from the Places group | Chip shows a pin; type Food |
| 6 | Chip menu → Open in maps → Google Maps / Apple Maps / Waze | Each opens the place in a new tab (or the app on phone) |
| 7 | Open in maps again | Last-chosen app listed first |
| 8 | Drag the linked item into a cell | Placement chip shows the pin; Open in maps works |
| 9 | Edit the item → Remove place → Undo | Pin and address gone, name kept; Undo restores the link |
| 10 | Rename the linked item "Chelsea Market lunch" | Pin stays; Google Maps still opens Chelsea Market |
| 11 | Stop the places function (or unset the key), type a name | "Place search unavailable" note; saving plain items works; Open in maps on linked items still works |
| 12 | 360 px width, keyboard only: type, ↓, Enter | Suggestion picked; focus visible; axe clean in light and dark |
