# Contract: Core (`packages/core`)

## Types

```ts
export interface Trip { /* existing */ coverPhoto: string | null; }

export interface CityPhoto {
  file: string; url: string; width: number; height: number;
  credit: string; license: string; sourceUrl: string;
}

export interface PlacePhotoRef { name: string; author: string; authorUri: string | null; }
export interface PopularPlace { /* existing */ photo: PlacePhotoRef | null; }

export type TripStatus =
  | { kind: 'before'; days: number }
  | { kind: 'during'; day: number; of: number }
  | { kind: 'after' };
```

## Ports

```ts
export interface CityPhotoService {
  /** The city's lead photo, or null when none. Rejects on failure. */
  lead(cityName: string): Promise<CityPhoto | null>;
  /** Up to `limit` landscape photos of the city (lead first). Rejects on failure. */
  more(cityName: string, limit: number): Promise<CityPhoto[]>;
  /** A specific photo by file name (for a chosen cover), or null if gone. Rejects on failure. */
  byFile(file: string): Promise<CityPhoto | null>;
}
```

`PlaceSearch` (feature 004/006) gains:

```ts
/** A short-lived image URL for a photo name, max width in px. Rejects on failure. */
photoUrl(photoName: string, maxWidthPx: number): Promise<string>;
```

## Commands and queries

| Name | Behavior |
|---|---|
| `setTripCoverPhoto(file: string \| null): Command` | Validates 1–300 chars; one undo step |
| `setTripLocation(location)` (changed) | Also sets `coverPhoto: null` when the location key changes |
| `tripToday(state, now: Date): ISODate` | Trip location's time zone, else device |
| `tripStatus(trip, today): TripStatus` | `before`: days = start − today; `during`: day = today − start + 1, of = trip length; `after` |
| `tripStatusLabel(status): string` | "In 1 day" / "In 12 days" / "Day 2 of 5" / "Ended" |
| `placementsOfPlace(state, placeId)` | `{ date, blockName }[]` for placements with that `placeId`, by date then block position |
