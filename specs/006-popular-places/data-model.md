# Data Model: Popular Places Tab

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

No database changes. Popular places are transient; once used they become ordinary feature 004
items or events (`PlaceFields`).

## PopularPlace (transient, session memory only)

| Field | Type | Notes |
|---|---|---|
| `placeId` | string | Provider place id |
| `name` | string | Display name |
| `kind` | string | Human-readable type, e.g. "Art museum", "Ramen restaurant"; may be empty |
| `address` | string | Short address; may be empty |
| `lat`, `lon` | number | Coordinates |
| `types` | string[] | Provider types (food detection) |
| `rating` | number \| null | 1.0–5.0 |
| `ratingCount` | number \| null | Number of reviews |

## PopularList (transient, session memory only)

| Field | Type | Notes |
|---|---|---|
| `city` | `Location` | The trip or day location it was fetched for |
| `todo` | `PopularPlace[]` | Up to 20, provider order |
| `food` | `PopularPlace[]` | Up to 20, provider order |
| `fetchedAt` | ISO string | Shown as "Popular on Google · HH:MM" |

Keyed by `locationKey(city)`. A place in both groups is kept once (research R5).

## Derived state (core queries)

- `isItemPlaced(state, itemId)` = `placedCount(state, itemId) > 0`
- `isPlacePlaced(state, placeId)` = any item or placement with that `placeId`
- `tripCities(state)` = trip location, then distinct day overrides in date order

## Conversions

- `popularToPlace(p): Place` → `{ id: p.placeId, provider: 'google', name: p.name, address:
  p.address, lat: p.lat, lon: p.lon, category: p.types[0] ?? null }` (validated by
  `validatePlace`).

## Commands

- `placePlace(place, type, date, blockId, beforePlacementId?)`: one new placement linked to
  `place`, `sourceItemId: null`; one undo step.
- Existing `addItem(name, type, notes, link, place)` is used for "Add to my list" and quick-add.
