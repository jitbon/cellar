# Research: Details for Linked Places

## R1 — One new "info" lookup in the existing `places` function

- **Decision**: Add an `info` action to `supabase/functions/places/handler.ts`: input `{ placeId }`
  only; a Place Details (New) `GET /v1/places/{placeId}` **without** a session token and with the
  field mask
  `id,displayName,types,primaryTypeDisplayName,rating,userRatingCount,photos,regularOpeningHours,utcOffsetMinutes,websiteUri`.
  It returns a trimmed `info` object (contracts/places-info.md). Google `404`/`NOT_FOUND` →
  `{ error: 'not-found' }` with status 404; any other failure → the existing "unavailable" 503.
- **Rationale**: Reuses the function's key handling, CORS allow-list, timeouts and tests (features
  004/006). A separate action keeps the autocomplete `details` call (session-priced, Essentials
  fields) unchanged, so picking a suggestion costs the same as today.
- **Alternatives**: Widening the existing `details` field mask — would bill every suggestion pick
  at the Enterprise rate and still not cover Popular places or places linked earlier; rejected.

## R2 — Cost and caps

Google's field tiers (Places API data-fields page): `id`, `photos` → Essentials (IDs only);
`types` → Essentials; `displayName`, `primaryTypeDisplayName`, `utcOffsetMinutes` → Pro;
`rating`, `userRatingCount`, `regularOpeningHours`, `websiteUri` → **Enterprise**. A request is
billed at the highest tier among its fields, so each `info` call is one **Place Details
Enterprise** request.

- **Decision**: Accept Enterprise (rating and hours are the point of the feature). Fetch at most
  once per place per session (R4). Google caps quota per method, so the README's existing
  "300 Place Details requests per day" cap (set when Place Details only followed autocomplete
  picks, which are free) now also covers these Enterprise calls. Lower it to about **100 per day**
  and update the README sentence to say why; at 100/day the worst case is above the monthly free
  Enterprise allowance, but expected use (tens of openings a day) stays within it.
- **Alternatives**: Only Pro fields (no rating/hours) — fails FR-003/FR-003a.

## R3 — Opening hours: today's line and the week, in the place's time zone

`regularOpeningHours.periods` gives `{ open: { day 0–6 (Sunday=0), hour, minute }, close?: {…} }`;
a single period with `open` at day 0 00:00 and no `close` means open 24 hours. `utcOffsetMinutes`
gives the place's current offset.

- **Decision**: A pure core function `openingHours(info.hours, now)` returns
  `{ today: HoursLine, week: HoursLine[7] (Monday first) }` where a line is
  `{ day, kind: 'closed' | 'open-24h' | 'open', ranges: { openMin, closeMin }[] }`.
  "Today" is the weekday at `now + utcOffsetMinutes` (the place's local day, spec edge case);
  without an offset it falls back to the traveler's day. Periods that close on the next day show
  as e.g. 18:00–02:00 on the opening day. Times are minutes since midnight; the web formats them
  with `Intl.DateTimeFormat` in the viewer's locale (e.g. "9:00 AM" in en-US, "09:00" in en-GB),
  so text reads "Open today 9:00 AM–9:00 PM", "Closed today", "Open 24 hours".
- **Rationale**: Portable and table-testable (constitution III, V); locale formatting stays in the
  UI like temperatures (feature 002).
- **Alternatives**: Google's `weekdayDescriptions` strings — localized by Google and not
  reformattable, and no structured "today"; rejected for display, though it is a good test oracle.

## R4 — Session cache, like Popular

- **Decision**: `usePlaceInfo(placeId)` keeps results in a module-level `WeakMap<PlaceSearch,
  Map<placeId, PlaceInfo>>` plus a pending-promise map (pattern of `usePopularPlaces` and
  `usePlacePhoto`). Failures are not cached, so a later opening retries; `not-found` is cached for
  the session. Nothing goes to `localStorage` or the server (FR-006, provider terms).

## R5 — One detail view for both sources

- **Decision**: Generalize `PlaceDetail` to take a `subject`: the facts it can show at once
  (`name`, `address`, `kind`, optional `rating`, `ratingCount`, `photo`, the `Place` used for Open
  in maps, `placeId` for planned dates) and an `actions` slot. Popular passes its `PopularPlace`
  (photo and rating show at once) and its two actions; linked items pass the stored `Place` and
  "Place in a block"; linked events pass "Edit event". Both call `usePlaceInfo` to fill in what is
  missing plus hours and website. When info fails, a muted note reads "More details aren't
  available right now." (or "This place may no longer be listed." for not-found).
- **Rationale**: Spec FR-003 requires the same view; one component keeps them identical.

## R6 — Entry points

- **List** (`ItemPanel` `ItemRow`): for linked items the name becomes a button that opens the view
  (single click; double-click on the row still edits; the button stops the double-click from
  also editing); the menu gets "View details" first.
- **Schedule** (`PlacementChip`): the menu gets "View details" first for linked events; clicking
  the chip keeps opening edit (clarification).
- Unlinked items and events get neither (FR-009).

## R7 — Testing

- **Core**: `openingHours` table (single range, split lunch/dinner, overnight, 24 h, closed day,
  missing `close`, offset moving "today" across midnight, no data → null).
- **Function**: extend `supabase/tests/places-handler.test.ts` for `info`: field mask and no
  session token sent, only `placeId` accepted, mapping, 404 → not-found, failure → 503.
- **Web**: `usePlaceInfo` caching/dedupe/retry; `PlaceDetail` for both subjects, hours expand,
  website link (`target=_blank rel=noreferrer`), notes; entry points on list rows and chips.
- **E2E**: extend `mockPlaces` with an `info` response (and a failing mode); open details from a
  linked list item and a linked event; Popular view shows hours and website; axe in light/dark.
