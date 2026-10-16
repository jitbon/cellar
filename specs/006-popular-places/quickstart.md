# Quickstart: Popular Places Tab

Contracts: [core](./contracts/core.md), [places function](./contracts/places-function.md).
Data: [data-model.md](./data-model.md).

## Prerequisites

- Local Supabase running; no new migrations.
- `supabase/functions/.env` with `GOOGLE_PLACES_API_KEY` and `ALLOWED_ORIGINS` (feature 004),
  then `supabase functions serve places --env-file supabase/functions/.env`.
- In Google Cloud: a daily quota cap on Text Search (research R2).
- Web app running, signed in, a trip located in New York.

## Automated checks

```sh
pnpm lint && pnpm --filter web typecheck
pnpm test                 # core + web
pnpm test:db              # includes places handler tests
pnpm --filter web e2e     # places function mocked; never calls Google
```

## Manual scenarios

| # | Steps | Expected |
|---|---|---|
| 1 | Sidebar → Popular | ≤ 2 s: "Things to do" and "Food", up to 20 each, with kind, address, rating and reviews; "Popular on Google · HH:MM" |
| 2 | Drag "The Met" to Monday Afternoon | Linked Activity event in the cell; Popular card struck through; list unchanged |
| 3 | Drag the struck-through card to Tuesday Morning | Second event; card stays struck through |
| 4 | Food card menu → Place in a block → Wed Lunch | Linked Food event |
| 5 | Food card menu → Add to my list | Item appears in My list, linked, struck through only once placed |
| 6 | Undo twice | Steps 5 and 4 undone |
| 7 | My list: place an item | Name struck through, no "placed 1×"; drag it again works |
| 8 | Top line: type "ram" | List narrows to matches; Enter adds "ram" as Activity; line clears |
| 9 | Top line: type "Katz", pick Katz's Delicatessen | Linked Food item added |
| 10 | Add a day override (Boston), open Popular | City selector: New York, Boston |
| 11 | Trip without location → Popular | "Set where this trip is to see popular places" |
| 12 | Stop the places function → Popular for a new city | "Popular places unavailable right now"; list and planner work |
| 13 | Switch tabs back and forth | No new request for an already loaded city |
| 14 | 360 px, keyboard only | Tabs, cards and menus reachable; axe clean in light and dark |
