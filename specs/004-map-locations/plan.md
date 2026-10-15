# Implementation Plan: Map Locations for Items

**Branch**: `feature/004-map-locations` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-map-locations/spec.md`

## Summary

While typing an item's name (item panel, grid cell quick-add, or placement edit), a live list
of up to 5 real places appears under the field, biased to the trip's (or day's) location.
Picking one links the item to that place: the name becomes the place's name, the short address
and a pin show on the item, and food places switch the type to Food. Ignoring the list saves a
plain item as today. Linked items and placements offer "Open in maps" with Google Maps, Apple
Maps and Waze, last choice first. No in-app map (clarified).

Technical approach: a place snapshot is stored as flat nullable columns on `items` and
`placements` (migration `0007_places.sql`), so save, sync, merge and undo reuse the existing
pipeline. Core adds pure place helpers (food detection, map links, validation), extends the
item/placement commands, and adds a `PlaceSearch` port. Google Places API (New) is called only
from a Supabase Edge Function `places`, which holds the key; the web adapter calls that
function. Autocomplete sessions ending in an Essentials-only Place Details call keep cost at
$0 for personal use ([research.md](./research.md) R1–R3).

## Technical Context

**Language/Version**: TypeScript 5.x (strict); Node.js 22 LTS for tooling; Deno (Supabase Edge
Runtime) for the `places` function

**Primary Dependencies**: Unchanged (React 19, Vite, supabase-js v2, dnd-kit, lucide-react).
New external service: Google Places API (New), Autocomplete + Place Details, over `fetch` from
the Edge Function. No new npm packages.

**Storage**: Supabase Postgres, new nullable columns on `items` and `placements`
([contracts/database.md](./contracts/database.md)); map-app preference in `localStorage` via
the existing `KeyValueStore` port

**Testing**: Vitest (core, web, edge handler, DB), Playwright (e2e with the `places` function
mocked; never calls Google)

**Target Platform**: Evergreen desktop and mobile browsers; core reusable by the future mobile app

**Project Type**: Web application (existing pnpm monorepo: `packages/core`, `apps/web`, `supabase`)

**Performance Goals**: Suggestions within 1 s of a typing pause for 95% of searches (SC-002);
300 ms debounce; 5 s function timeout; typing and saving never wait on search (FR-002)

**Constraints**: Key only in Supabase secrets (FR-015); only typed text + bias coordinates sent
(FR-014); "Powered by Google" attribution (FR-013); WCAG 2.1 AA; 360 px; design tokens only;
Google daily quota caps as a cost backstop

**Scale/Scope**: Personal use, ~hundreds of picks/month; 1 Edge Function with 2 actions; ~4
UI pieces (place options group, place line on item/chip, "Open in maps" menu group, "Remove
place" action)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Pre | Post |
|---|---|---|---|
| I. Flexible block-based planning | Plain items stay the default (FR-001); a place never restricts where an item can go; link/change/remove are single undoable commands; copies keep independent snapshots | ✅ | ✅ |
| II. Clean, friendly interface | Linked state shown with a pin icon + address text, not color (FR-006); combobox follows the existing keyboard pattern; tokens only; 360 px and axe scenarios in quickstart | ✅ | ✅ |
| III. Portable core | Place types, validation, food detection, map links and commands in `packages/core`; network only behind the `PlaceSearch` port | ✅ | ✅ |
| IV. Integrations behind adapters | Google only in the Edge Function and `supabasePlaceSearch.ts`; key never in client (R2); any failure → "Place search unavailable", editing unaffected; purpose/cost/quota/fallback documented (R1); place data is a labeled snapshot ("Powered by Google") | ✅ | ✅ |
| V. Simplicity & verified changes | No places table, no server cache, no app detection, no new npm deps; core and handler unit tests (R9) | ✅ | ✅ |
| Constraints: location & data minimization | No device location; bias uses the trip/day location already typed by the traveler (R4); only typed text and coordinates leave the app | ✅ | ✅ |
| Workflow | specify → clarify (2 Qs) → plan; on feature branch | ✅ | ✅ |

No violations. Post-design note: the Edge Function is the project's first server-side code;
it is justified below because constitution IV forbids client-side keys.

## Project Structure

### Documentation (this feature)

```text
specs/004-map-locations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── core.md              # types, PlaceSearch port, helpers, command changes
│   ├── database.md          # migration 0007 columns + constraints
│   └── places-function.md   # Edge Function request/response
├── checklists/
│   └── requirements.md
└── tasks.md                 # created by /speckit-tasks
```

### Source Code (repository root)

```text
packages/core/
├── src/
│   ├── model/types.ts            # + PlaceFields, Place, PlaceSuggestion, MapApp
│   ├── model/validation.ts       # + validatePlace
│   ├── places/                   # NEW fields.ts (placeFields/placeOf), food.ts, mapLinks.ts
│   ├── commands/item.ts          # addItem/updateItem accept place
│   ├── commands/placement.ts     # addTypedPlacement/updatePlacement accept place; placeItem copies it
│   ├── queries/location.ts       # + suggestNear
│   ├── ports.ts                  # + PlaceSearch
│   └── index.ts
└── tests/                        # + places-*, item/placement place tests

apps/web/src/
├── adapters/supabasePlaceSearch.ts       # NEW: calls the places function
├── state/services.tsx                    # + places: PlaceSearch
├── state/usePlaceSuggestions.ts          # NEW: debounce, min length, session token, unavailable state
├── components/places/PlaceOptions.tsx    # NEW listbox group + "Powered by Google" (+ .module.css)
├── components/places/PlaceLine.tsx       # NEW pin + short address
├── components/places/OpenInMapsItems.tsx # NEW menu group: Google Maps / Apple Maps / Waze
├── components/list/ItemPanel.tsx         # name field suggestions; place line; menu actions
├── components/grid/Cell.tsx              # Places group under list suggestions
├── components/grid/CellSuggestions.tsx   # render both groups, shared active index
├── components/grid/PlacementChip.tsx     # pin, edit-form suggestions, Open in maps, Remove place
└── main.tsx                              # wire SupabasePlaceSearch

supabase/
├── migrations/0007_places.sql            # NEW
├── functions/places/handler.ts           # NEW request shaping + trimming (pure, testable)
├── functions/places/index.ts             # NEW Deno.serve wrapper
├── config.toml                           # [functions.places] verify_jwt = true
└── tests/                                # + place-columns.test.ts, places-handler.test.ts
```

**Structure Decision**: Same monorepo layout as 001–003. Place logic lives in a new
`packages/core/src/places/` folder; the only Google code is the Edge Function.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Supabase Edge Function `places` (first server code) | Google Places needs a key; constitution IV forbids keys in client code | Browser key with referrer restriction violates IV; no keyless provider handles restaurants well (R1) |
| Duplicated place columns on `items` and `placements` | Placements are independent copies today (name, notes, link); places follow suit | A shared `places` table needs joins, RLS and cleanup for no user-visible gain |
