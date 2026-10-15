# Contract: Core (`packages/core`)

New and changed public API. All pure; no DOM, no network (constitution III).

## Types (`model/types.ts`)

```ts
export type PlaceProvider = 'google';

export interface PlaceFields {
  placeId: string | null;
  placeProvider: PlaceProvider | null;
  placeName: string | null;
  placeAddress: string | null;
  placeLat: number | null;
  placeLon: number | null;
  placeCategory: string | null;
}

export interface Place {
  id: string;
  provider: PlaceProvider;
  name: string;
  address: string;
  lat: number;
  lon: number;
  category: string | null;
}

export interface PlaceSuggestion {
  placeId: string;
  name: string;
  address: string;
  types: string[];
}

export type MapApp = 'google' | 'apple' | 'waze';

export interface Item extends PlaceFields { /* existing fields */ }
export interface Placement extends PlaceFields { /* existing fields */ }
```

## Port (`ports.ts`)

```ts
export interface PlaceSearch {
  /** Up to 5 suggestions; [] when nothing matches. Rejects on any failure. */
  suggest(
    input: string,
    opts: { sessionToken: string; near: { lat: number; lon: number } | null },
  ): Promise<PlaceSuggestion[]>;
  /** Resolves a picked suggestion to a full Place. Ends the session. Rejects on failure. */
  details(suggestion: PlaceSuggestion, sessionToken: string): Promise<Place>;
}
```

## Places helpers (`places/`)

| Function | Behavior |
|---|---|
| `placeFields(place: Place \| null): PlaceFields` | Place → flat fields; `null` → all-null fields |
| `placeOf(row: PlaceFields): Place \| null` | Flat fields → Place, or `null` when plain |
| `isFoodPlace(types: string[]): boolean` | Research R5 |
| `mapLinks(place: Place): Record<MapApp, string>` | Research R6 URLs |
| `orderMapApps(preferred: MapApp \| null): MapApp[]` | Preferred first, then google, apple, waze |
| `validatePlace(place: Place \| null): ValidationError \| null` | Rules in data-model.md |

## Commands

| Command | Change |
|---|---|
| `addItem(name, type, notes?, link?, place?)` | New optional `place`; stores its fields |
| `updateItem(id, patch)` | `ItemPatch` gains `place?: Place \| null` (`null` removes) |
| `addTypedPlacement(date, blockId, name, afterId?, opts?)` | New optional `opts: { place?, type? }`; `type` defaults to `'activity'` |
| `updatePlacement(id, patch)` | `PlacementPatch` gains `place?: Place \| null` |
| `placeItem(...)` | Also copies the item's `PlaceFields` |

Each call is one history entry, so undo/redo works with no history changes. The UI decides
the type for a picked place with `isFoodPlace(suggestion.types)` and passes it in.

## Queries

| Query | Behavior |
|---|---|
| `suggestNear(state, date?): { lat, lon } \| null` | Day override when `date` given and set, else trip location, else `null` (R4) |
