# Feature Specification: Trip Photos

**Feature Branch**: `feature/007-trip-photos`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "for all four above suggestions" — the four photo ideas mocked up
in the "Cellar photo mockups" canvas: (1) city cover photos on trip cards, (2) a faded city
banner on the trip page, (3) small photo thumbnails on Popular cards, (4) a detail view with a
big photo when a Popular card is clicked. Also adds a "today" highlight on the grid, as shown in
the mockup.

## Clarifications

### Session 2026-10-16

- Q: Where should Popular card and detail photos come from? → A: The place provider's own photo
  of each place (accurate), loaded only for cards in view and one per detail view; Wikimedia is
  used only for city photos.
- Q: Can the traveler change a trip's cover photo? → A: Yes. The automatic city photo is the
  default; "Change cover photo" offers a few more photos of the same city to pick from. The
  choice is saved with the trip. No uploads.
- Q: Should the banner photo follow the card's cover photo? → A: No. Both start from the same
  automatic city photo, but the banner has its own choice, changed on the trip page ("Change
  photo" on the banner or "Change banner photo" in the trip menu); changing one never changes
  the other.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trip cards show a photo of the trip's city (Priority: P1)

On "Your trips", each trip card shows a wide photo of the trip's city across its top, with a
small status pill ("In 12 days", "Day 2 of 5", "Ended") and the trip's name, city and dates
below. A trip without a location shows a plain placeholder that says a location gives it a cover
photo. Each photo is credited.

**Why this priority**: The biggest visual payoff for the least effort; it makes the app feel
like a travel app from the first screen.

**Independent Test**: With trips in Kyoto, New York and Lisbon and one trip with no location,
open "Your trips": three cards show their city's photo with a credit, the fourth shows the
placeholder; every card still opens its trip.

**Acceptance Scenarios**:

1. **Given** a trip with a location, **When** "Your trips" opens, **Then** its card shows a
   photo of that city, its credit, and a status pill based on today's date.
2. **Given** a trip without a location, **Then** its card shows the placeholder and the text
   "Set a location to get a cover photo"; the card works normally.
3. **Given** no photo is found for a city or the photo service is unavailable, **Then** the card
   shows the placeholder (without the "set a location" text) and nothing else is affected.
4. **Given** the trip's location changes, **Then** its card shows the new city's photo the next
   time "Your trips" is shown (a previously chosen cover photo is dropped).
5. **Given** a located trip, **When** the traveler chooses "Change cover photo" (trip card menu
   or trip menu), **Then** up to 6 photos of the same city are offered with their credits;
   picking one makes it the trip's cover on the card and the banner, saved with the trip,
   synced to other devices and undoable. "Use automatic photo" returns to the default.

---

### User Story 2 - The trip page has a faded city banner (Priority: P2)

Under the trip header, a short banner shows the city photo behind a dark overlay with the city
name, "Day 2 of 5" (or "In 12 days", "Ended") and the credit. The traveler can hide the banner
to give the grid more room, and the choice is remembered on that device. Days that are today get
a highlighted day header on the grid.

**Why this priority**: Pretty and orienting, but it costs vertical space, so it must be easy to
turn off.

**Independent Test**: Open a located trip: the banner shows; hide it from the trip menu: it
disappears and stays hidden after a reload; show it again from the same menu.

**Acceptance Scenarios**:

1. **Given** a located trip with a photo, **When** it opens, **Then** the banner shows the
   photo, city, trip progress text and credit, with text readable over the photo.
2. **Given** the banner is showing, **When** the traveler chooses "Hide city banner" in the
   trip menu, **Then** it disappears and stays hidden for that traveler on that device until
   "Show city banner" is chosen.
3. **Given** a trip without a location or without a photo, **Then** no banner is shown.
4. **Given** today falls within the trip, **Then** today's day header is highlighted and
   labelled "Today" (text, not color alone).
5. **Given** a phone-width screen, **Then** the banner is shorter and never pushes the grid off
   the first screen.

---

### User Story 3 - Popular cards show small photos (Priority: P2)

Each Popular card (feature 006) shows a small square photo of the place at its left. Photos
load only for cards that scroll into view; until then, or when a place has no photo, a neutral
placeholder with the place's type icon is shown.

**Why this priority**: Makes the Popular list much easier to scan, but photos of individual
places cost money per photo, so it comes after the free trip-level photos.

**Independent Test**: Open Popular for New York: the visible cards show photos; cards further
down show photos only after scrolling to them.

**Acceptance Scenarios**:

1. **Given** the Popular tab with results, **Then** each visible card shows a small photo of its
   place.
2. **Given** a card has not scrolled into view, **Then** its photo is not requested.
3. **Given** a place has no photo or the photo fails, **Then** the card shows the placeholder
   and still works (drag, menu, strikethrough).
4. **Given** photos are shown, **Then** the required photo source credit is shown where the
   provider requires it.

---

### User Story 4 - Clicking a Popular card shows its details with a big photo (Priority: P3)

Clicking (or pressing Enter on) a Popular card opens a detail view: a large photo with its
credit, the name, kind and address, rating with review count, when it is already planned (e.g.
"Planned: Mon May 3 · Morning"), and the actions "Place in a block", "Add to my list" and "Open
in maps". It closes with the X, Escape or clicking outside.

**Why this priority**: Nice for deciding, and the cheapest place for a big photo (one per
click), but the card menu already offers the same actions.

**Independent Test**: Click "The Metropolitan Museum of Art" in Popular: the detail view shows
a big photo, its details and the three actions; "Place in a block" places it like the card menu
does.

**Acceptance Scenarios**:

1. **Given** the Popular tab, **When** a card is clicked or activated with the keyboard,
   **Then** the detail view opens with the large photo, details and three actions.
2. **Given** the place is already on the schedule, **Then** the detail view lists where
   ("Planned: Mon May 3 · Morning"; several lines if placed more than once).
3. **Given** the detail view, **When** an action is used, **Then** it behaves exactly as the
   same action in the card menu, and the view closes after "Place in a block".
4. **Given** dragging a card, **Then** the detail view does not open (a drag is not a click).
5. **Given** no photo, **Then** the view shows the placeholder in the photo area and everything
   else works.

### Edge Cases

- **Offline or photo service down**: every photo spot falls back to its placeholder; planning
  is never blocked (constitution IV).
- **Chosen cover photo no longer available** (removed from the free source): the trip falls back
  to the automatic photo, then the placeholder.
- **Same city on many trips**: each card shows that city's photo; repeated lookups are avoided
  within a session.
- **Ambiguous city names** ("Paris" in Texas vs France): the photo lookup uses the trip
  location's full name, which already includes the country.
- **Dark mode**: overlays and credits stay readable in both themes.
- **Reduced motion**: photos appear without fade or zoom animation.
- **Screen readers**: decorative city photos are hidden from assistive tech or given short alt
  text; the detail view's photo has alt text with the place's name.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Trip cards on "Your trips" MUST show a city photo for trips with a location, a
  placeholder otherwise, a status pill ("In N days", "Day N of M", "Ended"), and a visible
  photo credit.
- **FR-002**: City photos (cards and banner) MUST come from a free, openly licensed source and
  be credited as that source requires.
- **FR-002a**: The traveler MUST be able to change a trip's cover photo by picking from up to 6
  photos of the same city, or return to the automatic photo; the choice MUST be saved with the
  trip, sync like other trip changes and be undoable. Changing the trip's location MUST clear it.
- **FR-002b**: The banner photo MUST be chosen separately from the card's cover photo, from the
  trip page (a button on the banner and the trip menu), with the same up-to-6 city photos and
  "Use automatic photo"; saved with the trip, synced, undoable, and cleared when the location
  changes. Changing either photo MUST NOT change the other.
- **FR-003**: The trip page MUST show a city banner (photo, overlay, city, progress text, credit)
  under the header for located trips with a photo, hideable per device from the trip menu.
- **FR-004**: The grid MUST highlight today's day header with a "Today" label when today is
  within the trip.
- **FR-005**: Popular cards MUST show a small photo of the place, requested only when the card is
  in view, with a placeholder otherwise.
- **FR-006**: Clicking or keyboard-activating a Popular card (not dragging it) MUST open a detail
  view with a large photo, name, kind, address, rating and review count, where it is planned,
  and the actions "Place in a block", "Add to my list" and "Open in maps".
- **FR-007**: Every photo MUST have a fallback placeholder; a missing or failed photo MUST NOT
  affect any other behavior.
- **FR-008**: Place photos MUST show the attribution the place provider requires, and MUST NOT
  be stored beyond what the provider's terms allow.
- **FR-009**: Only the city name (for city photos) and the place's provider id (for place
  photos) MUST be sent to photo services; no other trip data.
- **FR-010**: Photos MUST NOT delay showing the page; layout must not jump when they arrive
  (space is reserved).

### Key Entities

- **City photo**: For one city name: an image link, its credit text and license link. Looked up
  when needed.
- **Chosen cover photo** (on the trip): an optional reference to one of the city's photos picked
  by the traveler for the trip card; empty means the automatic photo.
- **Chosen banner photo** (on the trip): the same, for the trip page banner, independent of the
  cover.
- **Place photo**: For one popular place: an image of the place and its required attribution.
  Fetched when shown; not stored.
- **Banner preference**: Per device, whether the city banner is hidden.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On "Your trips", every located trip shows its city photo within 2 seconds on a
  normal connection.
- **SC-002**: With photo services switched off, 100% of trip, planning and Popular flows still
  work, with placeholders in place of photos.
- **SC-003**: Opening the Popular tab for a city requests photos only for the cards visible
  without scrolling (about 6–8), not for all 40.
- **SC-004**: City photos add no cost; place photos for normal personal use stay within the
  provider's free monthly allowance.
- **SC-005**: Hiding the banner takes 2 actions and is remembered across reloads.

## Assumptions

- City photos come from Wikipedia / Wikimedia Commons lead images for the city (free, openly
  licensed, credited), the source used in the mockups.
- Place photos (Popular thumbnails and the detail view) come only from the same provider as
  Popular places (feature 006), through the same server-side relay, so no key reaches the
  browser; free sources are not used for places (confirmed in Clarifications).
- The detail view replaces nothing: the card menu stays as the quick path.
- No photos inside schedule cells or chips.
- No uploading your own trip photos (possible later feature).
- The "today" highlight is included because the mockup showed it; it needs no photos.
