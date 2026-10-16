# Contract: `places` Edge Function, new `popular` action

Extends feature 004's [places function](../../004-map-locations/contracts/places-function.md):
same auth (`verify_jwt`), CORS allow-list, 5 s timeout and error mapping.

## Request

```json
{ "action": "popular", "city": "New York, USA", "near": { "lat": 40.7128, "lon": -74.006 },
  "group": "todo" }
```

- `city`: 1–120 chars (the trip or day location name). `near`: required, valid lat/lon.
- `group`: `"todo"` or `"food"`. The client makes one request per group.

The handler calls `POST https://places.googleapis.com/v1/places:searchText` with:

- `textQuery`: `top tourist attractions in <city>` (todo) or `best restaurants in <city>` (food)
- `locationBias.circle`: center `near`, radius 15000 m
- `pageSize`: 20, `rankPreference`: `RELEVANCE`
- `X-Goog-FieldMask`: `places.id,places.displayName,places.shortFormattedAddress,places.location,places.types,places.primaryType,places.primaryTypeDisplayName,places.rating,places.userRatingCount`

## Response `200`

```json
{ "places": [ { "placeId": "ChIJ…", "name": "The Metropolitan Museum of Art",
  "kind": "Art museum", "address": "1000 5th Ave, New York", "lat": 40.7794, "lon": -73.9632,
  "types": ["art_museum", "museum", "tourist_attraction"], "rating": 4.8, "ratingCount": 104512 } ] }
```

At most 20. Places without `id`, `displayName` or `location` are dropped. `kind` comes from
`primaryTypeDisplayName.text` (empty if missing); `rating` / `ratingCount` are `null` when
missing.

## Errors

Same as feature 004: 400 `bad_request` for an invalid body, 503 `unavailable` for missing key,
Google errors, quota or timeout.
