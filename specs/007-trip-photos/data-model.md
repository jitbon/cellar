# Data Model: Trip Photos

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## Trip (existing, extended)

| Field | Type | Rules |
|---|---|---|
| `coverPhoto` | string \| null | Commons file name chosen by the traveler, 1–300 chars; `null` = automatic photo. Cleared when the trip location changes. |

Migration `0009_cover_photo.sql` ([contracts/database.md](./contracts/database.md)).

## CityPhoto (transient; cached per device for 7 days)

| Field | Type | Notes |
|---|---|---|
| `file` | string | Commons file name (what `coverPhoto` stores) |
| `url` | string | 1280 px image URL |
| `width`, `height` | number | Of that image, to reserve space |
| `credit` | string | Artist, plain text (HTML stripped); "Unknown" if missing |
| `license` | string | e.g. "CC BY-SA 4.0" |
| `sourceUrl` | string | Commons file page (credit link) |

Cache keys: `cellar.cityPhoto.v2.lead.<city name>` and `cellar.cityPhoto.v2.more.<city name>` (v2: file names are compared with underscores, since Commons answers with spaces), each
`{ value, fetchedAt }`, reused for 7 days.

## PlacePhotoRef (transient, session memory only)

Added to feature 006's `PopularPlace`:

| Field | Type | Notes |
|---|---|---|
| `photo` | `{ name: string; author: string; authorUri: string \| null } \| null` | First photo from Text Search; name never stored beyond the session |

The image itself is a short-lived `photoUri` from the `photo` action, kept in session memory by
photo name.

## Device preferences (KeyValueStore)

| Key | Value |
|---|---|
| `cellar.banner.hidden` | `"1"` when the city banner is hidden |

## Derived (core queries)

- `tripToday(state, now): ISODate`
- `tripStatus(trip, today)`: `before` (days until start) | `during` (day N of M) | `after`
- `placementsOfPlace(state, placeId): { date, blockName }[]`, sorted by date then block order
