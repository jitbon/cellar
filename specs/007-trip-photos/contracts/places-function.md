# Contract: `places` Edge Function changes

Extends features 004/006 (same JWT, CORS allow-list, 5 s timeout, error mapping).

## `popular` (changed)

Field mask adds `places.photos`. Each returned place gains:

```json
"photo": { "name": "places/ChIJ…/photos/AXCi…", "author": "Jane Doe",
           "authorUri": "https://maps.google.com/maps/contrib/…" }
```

from `photos[0].name` and `photos[0].authorAttributions[0]` (`displayName`, `uri`); `null` when the
place has no photos. No extra billing tier (the request is already Enterprise).

## `photo` (new)

Request: `{ "action": "photo", "name": "places/ChIJ…/photos/AXCi…", "maxWidthPx": 160 }`

- `name` must match `^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$` (else 400).
- `maxWidthPx`: integer 48–1600 (else 400).

Calls `GET https://places.googleapis.com/v1/<name>/media?maxWidthPx=<n>&skipHttpRedirect=true`
with `X-Goog-Api-Key`.

Response `200`: `{ "photoUri": "https://lh3.googleusercontent.com/…" }`

Errors: 400 `bad_request`; 503 `unavailable` (missing key, Google error, expired name, quota,
timeout). The client shows the placeholder on any error.
