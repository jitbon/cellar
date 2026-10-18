# Contract: `places` function `info` action, port and UI

## Request (POST `{SUPABASE_URL}/functions/v1/places`, signed-in user)

```json
{ "action": "info", "placeId": "ChIJ…" }
```

Only `placeId` (string, 1–300 chars) is accepted; anything else → 400. No session token.

## Google call (server side)

`GET https://places.googleapis.com/v1/places/{placeId}` with
`X-Goog-FieldMask: id,displayName,types,primaryTypeDisplayName,rating,userRatingCount,photos,regularOpeningHours,utcOffsetMinutes,websiteUri`
and the existing timeout.

## Responses

| Case | Status | Body |
|---|---|---|
| Found | 200 | `{ "info": { placeId, name, kind, types, rating, ratingCount, photo, hours, utcOffsetMinutes, website } }` (shapes in data-model.md; `photo` from the first photo as Popular does; `hours.periods` copied from `regularOpeningHours.periods`; `website` only if it starts with `http://` or `https://`) |
| Google 404 / NOT_FOUND | 404 | `{ "error": "not-found" }` |
| Missing key, Google error, timeout | 503 | existing unavailable body |
| Bad input | 400 | existing bad-request body |

## Port (`packages/core/src/ports.ts`)

```ts
/** Photo, type, rating, hours and website for a place id. Rejects (code 'not-found' when gone). */
info(placeId: string): Promise<PlaceInfo>;
```

## Core function (`packages/core/src/places/hours.ts`)

```ts
export function openingHours(info: Pick<PlaceInfo, 'hours' | 'utcOffsetMinutes'>, now: Date): OpeningHours | null;
```

## UI

| Where | Entry | View actions |
|---|---|---|
| My list, linked item | name button (click/Enter) and menu "View details" (first) | Place in a block · Open in maps |
| Schedule, linked event | menu "View details" (first); chip click still edits | Edit event · Open in maps |
| Popular card | unchanged (card click / name) | Place in a block · Add to my list · Open in maps (unchanged) |

View content, top to bottom: photo (or type icon) with credit · kind · address · ★ rating (count)
· hours line ("Open today 9:00 AM–9:00 PM" / "Closed today" / "Open 24 hours") with a "Show week"
disclosure button (`aria-expanded`) listing seven lines, today marked in text ("Today") · Website
link (opens in a new tab, `rel="noreferrer"`) · planned dates · actions. While info loads, a
`role="status"` "Loading details…" line; on failure the muted unavailable / not-found note.
