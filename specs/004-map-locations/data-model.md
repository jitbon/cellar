# Data Model: Map Locations for Items

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## Place (value object, stored flat)

A snapshot of a real-world place, saved when the traveler picks a suggestion. Never
re-fetched (spec assumption).

| Field | Type | Rules |
|---|---|---|
| `placeId` | string | Provider's place id; 1–300 chars |
| `placeProvider` | `'google'` | Only value for now (adapter-ready, R1) |
| `placeName` | string | Name from the provider; 1–200 chars, trimmed |
| `placeAddress` | string | Short address; 0–300 chars (may be empty for natural features) |
| `placeLat` | number | −90…90 |
| `placeLon` | number | −180…180 |
| `placeCategory` | string \| null | Provider's first type, e.g. `ramen_restaurant`; ≤ 100 chars |

**All-or-none**: `placeId`, `placeProvider`, `placeName`, `placeAddress`, `placeLat`,
`placeLon` are either all set (linked) or all null (plain). `placeCategory` may be null on a
linked row. Enforced in core validation and by a DB check.

`placeName` is kept separately from the item's `name` so renaming "Chelsea Market" to
"Chelsea Market lunch" keeps the map link correct (US3 scenario 4).

## Item (existing, extended)

`Item extends PlaceFields`. No other change. A linked item is any item with `placeId !== null`.

## Placement (existing, extended)

`Placement extends PlaceFields`. `placeItem` copies the item's place fields along with name,
type, notes and link. Later edits to either side don't affect the other (spec edge case).

## Map app preference (device-local)

| Key | Value | Store |
|---|---|---|
| `cellar.mapApp` | `'google' \| 'apple' \| 'waze'` | `KeyValueStore` (localStorage on web) |

Missing or unknown values mean no preference; Google Maps is listed first.

## Transitions

```text
plain ──pick suggestion──▶ linked ──pick another──▶ linked (new place)
  ▲                          │
  └──────"Remove place"──────┘   (name, type, notes, link kept)
```

Each transition is one command and one undo step. Picking a food place on create sets
`type = 'food'` in the same step; on edit, the form's type field is pre-set to Food and the
traveler can change it before saving.

## Transient (not stored)

- **PlaceSuggestion**: `{ placeId, name, address, types[] }`, returned by autocomplete.
- **Session token**: random UUID per name-field focus, sent with autocomplete and the
  closing details call (R1).
