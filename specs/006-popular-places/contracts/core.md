# Contract: Core (`packages/core`)

Additions only; feature 004 types (`Place`, `PlaceFields`, `PlaceSearch`) are reused.

## Types (`model/types.ts`)

```ts
export interface PopularPlace {
  placeId: string;
  name: string;
  kind: string;
  address: string;
  lat: number;
  lon: number;
  types: string[];
  rating: number | null;
  ratingCount: number | null;
}

export interface PopularList {
  city: Location;
  todo: PopularPlace[];
  food: PopularPlace[];
  fetchedAt: string;
}
```

## Port (`ports.ts`)

`PlaceSearch` gains:

```ts
/** Up to 20 per group for the city; places in both groups appear once. Rejects on failure. */
popular(city: Location): Promise<PopularList>;
```

## Functions

| Function | Behavior |
|---|---|
| `popularToPlace(p: PopularPlace): Place` | data-model.md "Conversions" |
| `isItemPlaced(state, itemId): boolean` | `placedCount > 0` |
| `isPlacePlaced(state, placeId): boolean` | any item or placement with that `placeId` |
| `tripCities(state): Location[]` | trip location, then distinct day overrides by date |
| `matchesItemName(item, text): boolean` | case/accent-insensitive substring, same folding as `suggestItems`; empty text matches all |
| `placePlace(place, type, date, blockId, beforePlacementId?): Command` | new linked placement, `sourceItemId: null`; validates cell and place |
