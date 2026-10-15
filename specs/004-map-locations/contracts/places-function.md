# Contract: Edge Function `places` (`supabase/functions/places/`)

Relays place search to Google so the API key stays server-side (research R2). Request
shaping and response trimming live in `handler.ts` (plain `fetch`/`Request`, testable with
Vitest); `index.ts` only wires it to `Deno.serve`.

- **Auth**: `verify_jwt = true`; requests need the signed-in user's `Authorization: Bearer`.
- **Secret**: `GOOGLE_PLACES_API_KEY` (`supabase secrets set`; locally
  `supabase/functions/.env`, gitignored).
- **Method**: `POST`, JSON body, JSON response. CORS allows only origins listed in `ALLOWED_ORIGINS` (comma-separated, default `http://localhost:5173`); the request `Origin` is echoed with `vary: origin`, and the header is omitted otherwise.

## `{"action":"suggest"}`

Request:

```json
{ "action": "suggest", "input": "chelsea mar", "sessionToken": "uuid",
  "near": { "lat": 40.74, "lon": -74.0 } }
```

`input` is 3–100 chars; `near` is optional. Calls `POST places:autocomplete` with
`locationBias.circle` (radius 30000 m) when `near` is set.

Response `200`:

```json
{ "suggestions": [ { "placeId": "ChIJ…", "name": "Chelsea Market",
  "address": "9th Avenue, New York, NY, USA", "types": ["market", "point_of_interest"] } ] }
```

At most 5 items. Query predictions (no `placePrediction`) are dropped.

## `{"action":"details"}`

Request: `{ "action": "details", "placeId": "ChIJ…", "sessionToken": "uuid" }`

Calls `GET places/{placeId}` with `X-Goog-FieldMask: id,location,shortFormattedAddress`.

Response `200`:

```json
{ "place": { "id": "ChIJ…", "lat": 40.742, "lon": -74.006, "address": "75 9th Ave, New York" } }
```

The web adapter adds `provider: 'google'` and takes `name` and `category` (first type) from
the picked suggestion (research R3).

## Errors

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "bad_request" }` | Invalid body |
| 401 | (Supabase) | Missing/invalid JWT |
| 503 | `{ "error": "unavailable" }` | Key not set, Google error, quota hit, timeout (5 s) |

The web adapter treats any non-200 or network failure as a rejection; the UI shows
"Place search unavailable" (FR-012).
