# Research: Popular Places Tab

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1. Source of "popular" places

- **Decision**: Google Places API (New) **Text Search**, two requests per city: `"top tourist
  attractions in <city>"` and `"best restaurants in <city>"`, each with `locationBias` = 15 km
  circle around the city, `pageSize` 20, `rankPreference` RELEVANCE. Results are shown in
  Google's order.
- **Rationale**: Same provider and relay as feature 004 (no new account or key). Text Search
  ranks well-known, well-reviewed places for these queries, which matches "popular". One request
  returns up to 20 results, matching FR-002 without paging.
- **Alternatives considered**: Nearby Search with `includedTypes` (rejected: ranks by
  distance/prominence around a point and needs type lists per category; the text queries give
  better "must-see" results); a separate travel content API such as Foursquare or TripAdvisor
  (rejected: second provider, second key, second set of terms for no clear gain).

## R2. Cost

- **Fields**: `places.id,places.displayName,places.shortFormattedAddress,places.location,
  places.types,places.primaryType,places.primaryTypeDisplayName,places.rating,
  places.userRatingCount`. `rating` and `userRatingCount` put each request in the **Text Search
  Enterprise** tier ([data fields](https://developers.google.com/maps/documentation/places/web-service/data-fields));
  a request is billed at its highest tier.
- **Free use**: Enterprise SKUs have a 1,000-request monthly free cap (verify the current
  price per 1,000 beyond it on Google's pricing page at implementation).
- **Expected use**: 2 requests per city per session (R3). Opening Popular for 3 cities in 50
  sessions a month is 300 requests, well inside the free cap.
- **Guard**: add a daily quota cap on Text Search in Google Cloud (e.g. 100/day) to the README
  setup steps.
- **Alternative considered**: dropping rating and review count to stay in the Pro tier
  (rejected: the spec's popularity hint needs them, and usage is far below the free cap).

## R3. Caching (constrained by Google's terms)

- **Decision**: Keep popular lists **in memory for the browser session**, keyed by city and
  group (things to do / food), with the fetch time. No `localStorage`, no database table.
- **Rationale**: Google's service terms allow caching place IDs, and latitude/longitude for up
  to 30 days, but give no caching exception for names, addresses or ratings
  ([service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20240522)).
  The spec originally asked for 7-day reuse; it was changed to session-only (FR-010, SC-002).
  Constitution IV ("cached and labeled") is met by the session cache plus the "Popular on Google ·
  HH:MM" label.
- **Alternatives considered**: a shared server cache table (rejected: stores place content
  beyond what the terms allow); `localStorage` for 7 days (rejected: same reason).

## R4. Relay changes

- **Decision**: Add a `popular` action to the existing `places` Edge Function (contract in
  [contracts/places-function.md](./contracts/places-function.md)). Same JWT requirement, CORS
  allow-list, 5 s timeout and `unavailable` mapping as feature 004.
- **Rationale**: Keeps the key server-side (constitution IV) with no new function.

## R5. Food vs things to do

- **Decision**: The group a card comes from sets its type: "Food" results → `food`, "Things to
  do" → `activity`. A place returned by both queries is shown once, in Food if
  `isFoodPlace(types)` (feature 004), otherwise in Things to do.

## R6. "Placed" state

- **Decision**: Derived, never stored. A list item is placed when `placedCount(state, id) > 0`
  (existing). A popular place is placed when any item or event in the trip has
  `placeId === popular.placeId`.
- **Display**: name with `text-decoration: line-through` plus a visually hidden ", placed" in
  the card's accessible name; the `placed N×` count is removed. Dragging is unaffected.

## R7. Dragging popular cards

- **Decision**: Popular cards use the existing dnd-kit setup with a new id prefix
  `popular:<placeId>` and the card's data attached to the draggable. `DndProvider.onDragEnd`
  handles the prefix by dispatching a new core command `placePlace(place, type, date, blockId,
  beforeId?)`, which creates a linked event with `sourceItemId: null` (clarification: no list
  item is created). `DragLayer` shows the popular card's name and type while dragging.
- **Non-drag path**: card menu "Place in a block" opens the existing `CellPickerDialog`; "Add to
  my list" dispatches `addItem(name, type, null, null, place)`; "Open in maps" reuses
  `OpenInMapsItems`.

## R8. Cities for multi-city trips

- **Decision**: New core query `tripCities(state)`: the trip location first, then each distinct
  day-override location in date order (deduplicated with the existing `locationKey`). The tab
  shows a city selector only when there is more than one.

## R9. Quick-add line

- **Decision**: The panel's search input becomes a `PlaceNameField`-style combobox (feature 004
  suggestions). Its text also filters the list by name (case- and accent-insensitive, same
  folding as `suggestItems`). Enter with no active suggestion dispatches `addItem(text,
  'activity')`; picking a suggestion adds a linked item (Food for food places). After adding, the
  line clears (so the full list shows again) and keeps focus.

## R10. Testing

- Core (Vitest): `tripCities`, `isPlacePlaced`, `placePlace` (+ undo), `popularToPlace`,
  filter-by-name helper.
- Edge handler (Vitest, mocked fetch): `popular` request shape, field mask, mapping, errors.
- Web (Vitest): tabs, Popular states (no location, loading, unavailable, empty, results),
  strikethrough on both card kinds, card menu, quick-add and filtering.
- E2E (Playwright, `places` function mocked): drag a popular card into a cell, strikethrough,
  re-drag, menu path, quick-add, axe in light/dark, 360 px.

## Noted outside this feature

Feature 004 stores linked places (name, address, coordinates) on items and events indefinitely.
Under the terms in R3, coordinates should be refreshed or dropped after 30 days and address
text has no caching exception. This is out of scope for 006, but it should be reviewed as its
own follow-up.
