# Research: Map Locations for Items

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1. Place-search provider and cost

- **Decision**: Google Places API (New): Autocomplete (New) for the live list, then one
  Place Details (New) call when the traveler picks a suggestion, both sharing a session token.
- **Rationale**: The user asked for Google Maps. Google's current pricing makes Autocomplete
  requests in a session that ends in Place Details free (session usage has an unlimited free
  cap), and Place Details Essentials has a 10,000-request monthly free cap
  ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)). Personal use is
  a few hundred picks a month, so expected cost is $0.
- **Cost guards**: (a) search only after 3 characters and a 300 ms typing pause; (b) a new
  session token per name-field focus, ended by the pick; (c) a daily quota cap on the Google
  Cloud project (e.g. 1,000 Autocomplete and 300 Place Details requests/day) so a bug cannot run
  up a bill. Abandoned sessions fall back to per-request Autocomplete pricing (10,000 free/month,
  then $2.83 per 1,000), still within the free cap at personal scale.
- **Fallback**: everything in FR-012. Missing key, quota hit, network or provider errors all
  become "Place search unavailable"; items are still created as plain text.
- **Alternatives considered**: Google Maps JavaScript Places widget with a referrer-restricted
  browser key (rejected: constitution IV forbids keys in client code, and the widget's styling
  can't follow our design tokens); OpenStreetMap Nominatim (rejected: weak at businesses and
  restaurants, which are the main use, and its usage policy forbids autocomplete-as-you-type).

## R2. Keeping the key off the client

- **Decision**: A Supabase Edge Function `places` relays requests to Google. The key is a
  Supabase secret (`GOOGLE_PLACES_API_KEY`). The function requires a signed-in user's JWT
  (Supabase's default `verify_jwt`), so anonymous callers can't spend the quota.
- **Rationale**: Supabase is already the backend; Edge Functions add no new host or account.
  The relay also trims Google's response to only the fields we use (contract in
  [contracts/places-function.md](./contracts/places-function.md)).
- **Alternatives considered**: a separate server (rejected: new hosting for two endpoints);
  Postgres `http` extension RPC (rejected: blocking HTTP inside the database, harder to test).

## R3. Which fields to request (keeping to the cheapest tier)

- **Decision**: Take the name (`structuredFormat.mainText`), short address
  (`structuredFormat.secondaryText`) and `types` from the Autocomplete prediction. Fetch only
  `id,location,shortFormattedAddress` from Place Details, using a field mask.
- **Rationale**: Name and types from Autocomplete are free within the session. Details with
  only these fields bills at Essentials. Requesting `displayName` or `primaryType` from Details
  would move it to the Pro tier (5,000 free/month, higher price). Verify the field-to-tier
  mapping against Google's docs when implementing.

## R4. Ordering by trip location

- **Decision**: Send `locationBias` as a 30 km circle around the effective location: the day's
  location override when adding from a grid cell on that day, otherwise the trip location
  (both from feature 002). No bias when neither is set.
- **Rationale**: Bias, not restriction, so "JFK Airport" still works for a Manhattan trip.
  Only the coordinates leave the device, never the trip name or other items (FR-014).

## R5. Detecting food places

- **Decision**: A core function `isFoodPlace(types)` returns true if any type is in a fixed
  set: `restaurant`, `cafe`, `coffee_shop`, `bar`, `bakery`, `meal_takeaway`, `meal_delivery`,
  `food_court`, `ice_cream_shop`, `dessert_shop`, `food`, or ends in `_restaurant`
  (e.g. `ramen_restaurant`). Chelsea Market (a market/tourist attraction) stays an activity.
- **Rationale**: Google's Place Types (Table A) has dozens of cuisine-specific
  `*_restaurant` types; the suffix rule covers them without a long list.

## R6. Opening map apps

- **Decision**: Use each provider's universal web link, which opens the native app when it is
  installed and the website otherwise, with no app detection:
  - Google Maps: `https://www.google.com/maps/search/?api=1&query=<name, address>&query_place_id=<placeId>`
  - Apple Maps: `https://maps.apple.com/?q=<name>&ll=<lat>,<lon>`
  - Waze: `https://waze.com/ul?ll=<lat>,<lon>&navigate=yes`

  Opened in a new tab (`noopener,noreferrer`). Links are built by a pure core function from
  the saved place snapshot, so they work offline from the search service (US2 scenario 5).
- **Rationale**: Custom schemes (`comgooglemaps://`, `waze://`) fail silently or show an error
  on desktop and when the app is missing, which the spec forbids.
- **Last choice**: stored per device under `cellar.mapApp` via the existing `KeyValueStore`
  port, and listed first (FR-008).

## R7. Storing the place

- **Decision**: Flat nullable columns on `items` and `placements` (`place_id`,
  `place_provider`, `place_name`, `place_address`, `place_lat`, `place_lon`,
  `place_category`), all set or all null except `place_category`. Same pattern as 002's
  location columns.
- **Rationale**: The repository maps columns generically and `applyRemote` merges whole rows,
  so save, sync, realtime and undo work without new code paths. Placements copy the snapshot
  like they copy name, notes and link today.
- **Alternatives considered**: a shared `places` table referenced by id (rejected: needs
  joins, RLS and garbage collection, and the spec says copies are independent anyway).

## R8. Suggestions UI

- **Decision**: One hook, `usePlaceSuggestions(text, near)`, drives a shared `PlaceOptions`
  listbox group used in three name fields: the item panel's add/edit form, the grid cell's
  quick-add input (below the existing "From your list" group), and the placement edit form.
  The group footer shows "Powered by Google" as Google's attribution policy requires when
  predictions are shown without a Google map.
- **Rationale**: Reuses the existing combobox keyboard pattern from `CellSuggestions` and
  `LocationPicker` (arrow keys, Enter, Escape, `aria-activedescendant`).
- **Enter with no active option** saves plain text (spec US1 scenario 3).

## R9. Testing

- Core (Vitest): `isFoodPlace`, `mapLinks`, place validation, `setItemPlace` /
  `setPlacementPlace` / `addItem` / `addTypedPlacement` with place, `placeItem` copying the
  snapshot, undo of each.
- Edge function (Vitest, `fetch` mocked): request shaping, field mask, error mapping to
  `unavailable`, 401 without JWT.
- DB (Vitest against local Supabase): all-or-none and range constraints.
- E2E (Playwright, `places` function route mocked): US1–US3 flows, unavailable state,
  axe checks on the listbox in light and dark.
