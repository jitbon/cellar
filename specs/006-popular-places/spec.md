# Feature Specification: Popular Places Tab

**Feature Branch**: `feature/006-popular-places`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "ima need some sort of "popular destination" api/service for this
next one. In the sidebar, maybe another tab on the "activities and food", where someone can
find popular destinations/food places for the city they're in. These can just be drag-and
dropped, and I think for those event cards a simple strikethrough will suffice rather than a
count (placed x3). They can be struck through but also draggable again. this applies to the
current list too. I also think rather than "search" that free input line should be for
quick-adding events."

## Clarifications

### Session 2026-10-15

- Q: When a popular place is dragged onto the schedule, should it also be saved to the
  traveler's list? → A: No. Only the event is created; "Add to my list" in the card menu is the
  way to save it to the list.
- Q: As the traveler types in the quick-add line, should the list narrow to matching items like
  search did? → A: Yes. Typing narrows the list to matches; Enter adds the new item; clearing
  the line shows everything again.
- Q: How should the two Popular groups be laid out? → A: As two sub-tabs, "THINGS TO DO" on the
  left and "FOOD" on the right, showing one group at a time (Things to do first).
- Q: How is the city chosen, given the traveler may not stay in one city all day? → A: A City
  dropdown listing the trip's cities, then any searched cities, with "Search for city…" as the
  last option; it opens a city search, and the city found is added to the dropdown and
  selected. Trips without a location get a "Search for a city" button.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse popular places for the trip's city and drag them in (Priority: P1)

The sidebar ("Activities & food") gets a second tab, **Popular**, next to the traveler's own
list. It shows well-known things to do and places to eat in the city the trip is in, each with
its name, kind (e.g. museum, ramen), short address and a popularity hint (rating and number of
reviews). The traveler drags any card onto a cell of the schedule, exactly like their own list
items. The new event is linked to that real place, so it shows its address and can be opened in
a map app (feature 004). Food places become Food events; everything else becomes an Activity.

**Why this priority**: This is the new capability: ideas for what to do and eat without
leaving the planner.

**Independent Test**: Open a trip located in New York, switch to Popular: up to 20 things to do
and up to 20 food places appear. Drag "The Metropolitan Museum of Art" onto Monday Afternoon:
an Activity event linked to that place appears in the cell.

**Acceptance Scenarios**:

1. **Given** a trip with a location, **When** the traveler opens the Popular tab, **Then** popular
   places for that city appear, split into "Things to do" and "Food", each card showing name,
   kind, short address and rating with review count.
2. **Given** the Popular tab, **When** the traveler drags a card onto a cell, **Then** a new
   event linked to that place is created there, typed Food for food places and Activity
   otherwise, and can be undone.
3. **Given** a popular card, **When** the traveler uses its menu instead of dragging ("Place in
   a block" or "Add to my list"), **Then** the same result is reached without dragging
   (keyboard and touch users).
4. **Given** a trip without a location, **When** the traveler opens Popular, **Then** they see
   "Set where this trip is to see popular places" with a way to set the location; nothing else
   breaks.
5. **Given** a multi-city trip (some days have a location override), **When** the traveler
   opens Popular, **Then** they can switch between the trip's cities, starting with the trip
   location.
6. **Given** the popular-places service is unavailable, **When** the traveler opens Popular,
   **Then** they see "Popular places unavailable right now"; their own list and the planner work
   as normal.

---

### User Story 2 - Placed cards are struck through, not counted (Priority: P1)

Cards that are already on the schedule (in the traveler's list or in Popular) show their name
struck through instead of a "placed 3×" count. Struck-through cards stay fully usable: they can
be dragged into more cells, edited and so on. This tells the traveler at a glance what is still
unplanned.

**Why this priority**: The user asked for it explicitly for both tabs, and it replaces an
existing display.

**Independent Test**: Place a list item in one cell: its card is struck through and has no
count. Drag the struck-through card into another cell: a second event appears and the card
stays struck through. Remove both events: the strikethrough disappears.

**Acceptance Scenarios**:

1. **Given** a list item placed one or more times, **Then** its card shows the name struck
   through and no "placed N×" count.
2. **Given** a popular place already on the schedule (any event linked to the same place),
   **Then** its Popular card is struck through.
3. **Given** a struck-through card, **When** dragged onto a cell, **Then** a new event is
   created as usual.
4. **Given** all events from a card are removed, **Then** the card is no longer struck through.
5. **Given** a struck-through card, **Then** its placed state is also available as text to
   assistive technology (e.g. "placed"), not conveyed by the line alone.

---

### User Story 3 - The panel's top line quick-adds instead of searching (Priority: P2)

The free text line at the top of the traveler's list, today a "Search" box, becomes a quick-add
line: type a name and press Enter to add it to the list right away. While typing, the list
narrows to items matching the text (so an existing "Ramen" is visible before adding another),
and the same
place suggestions as elsewhere (feature 004) appear, so "Katz's" can become the real place in
one pick. Ignoring them adds a plain item.

**Why this priority**: A small change to an existing control; useful, but the list works
without it.

**Independent Test**: Type "Rest day" in the top line and press Enter: "Rest day" appears in the
list as an Activity and the line clears, ready for the next one.

**Acceptance Scenarios**:

1. **Given** the list tab, **When** the traveler types a name and presses Enter, **Then** a new
   Activity item with that name is added, the line clears and keeps focus.
2. **Given** place suggestions are showing, **When** the traveler picks one, **Then** the item
   is added linked to that place (Food for food places).
3. **Given** an empty line, **When** Enter is pressed, **Then** nothing is added.
4. **Given** text in the line, **Then** the list shows only items whose names match it,
   combined with the All / Activities / Food / Not yet placed filters; clearing the line shows
   all items again. There is no separate search box.

### Edge Cases

- **Popular place already in the traveler's list**: dragging from Popular still creates a new
  event; the list item and the Popular card both become struck through because they share the
  place.
- **Same place on several days**: allowed; one strikethrough, no count.
- **Changing the trip location**: Popular refreshes for the new city.
- **Small cities with few results**: show what there is; "No popular places found" when none.
- **Phone width (360 px)**: tabs and cards fit; drag uses the existing long-press, and the card
  menu is the non-drag path.
- **Undo**: placing from Popular and quick-adding are each one undo step.
- **Stale data**: popular lists are reused for the session instead of being fetched on every
  visit, and show their source and when they were fetched (e.g. "Popular on Google · 10:42").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sidebar MUST have two tabs: the traveler's list (existing) and **Popular**.
- **FR-002**: Popular MUST show up to 20 things to do and up to 20 food places for the selected
  city, each with name, kind, short address, rating and review count, ordered by popularity, as
  two sub-tabs ("THINGS TO DO" left, "FOOD" right; one group visible at a time, Things to do
  first, arrow keys switch).
- **FR-003**: The selected city MUST default to the trip location. A City dropdown MUST list the
  trip's cities, then any cities the traveler searched for, and end with "Search for city…",
  which asks for any city and adds it to the dropdown, selected. A trip without a location MUST
  offer the search too. Added cities and the choice last for the session.
- **FR-004**: Popular cards MUST be draggable onto schedule cells, creating an event linked to
  the place (name, address, coordinates as in feature 004), typed Food for food places and
  Activity otherwise. Dragging MUST NOT add the place to the traveler's list.
- **FR-005**: Each Popular card MUST offer a menu with "Place in a block", "Add to my list" and
  "Open in maps", so every action is possible without dragging.
- **FR-006**: List and Popular cards MUST show placed state as a strikethrough of the name plus
  a text equivalent for assistive technology, and MUST NOT show a "placed N×" count.
- **FR-007**: A list item counts as placed when any event on the schedule came from it; a
  Popular card counts as placed when any event or list item in the trip is linked to the same
  place.
- **FR-008**: Struck-through cards MUST remain draggable and usable like any other card.
- **FR-009**: The list tab's top text line MUST add a new item on Enter (Activity by default,
  trimmed, non-empty), clear itself and keep focus; it MUST offer the feature 004 place
  suggestions; while it holds text the list MUST narrow to matching item names (combined with
  the filters), replacing the separate search box.
- **FR-010**: Popular results MUST be reused for the rest of the session per city (not stored
  on the device or server, because the provider's terms don't allow storing place details), and
  MUST show their source and fetch time.
- **FR-011**: When popular places are unavailable, slow or not configured, the tab MUST show a
  clear unavailable message; the list tab and planning MUST be unaffected.
- **FR-012**: Only the selected city's name and location MUST be sent to the popular-places
  service; no other trip data.
- **FR-013**: Placing from Popular, "Add to my list" and quick-add MUST each be one undoable step.

### Key Entities

- **Popular place**: A real place suggested for a city: provider place id, name, kind, short
  address, coordinates, rating, review count, and whether it is food. Not stored in the trip
  unless the traveler places it or adds it to their list (then it becomes a normal linked
  item or event, feature 004).
- **Popular list (session only)**: For one city: things to do and food places, with source and
  fetch time; kept in memory for the session, never stored.
- **List item / Event** (existing): unchanged; "placed" is derived, not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From opening the Popular tab, a traveler can put a popular place on the schedule
  in one drag (or 3 actions via the card menu).
- **SC-002**: The Popular tab shows results within 2 seconds of opening for a city not yet
  loaded, and instantly for a city already loaded in this session.
- **SC-003**: A traveler can tell placed from unplaced cards at a glance, with no number to
  read.
- **SC-004**: Quick-adding a plain item takes one line of typing and Enter, with no dialog.
- **SC-005**: With the popular-places service switched off, 100% of existing list and planning
  flows still work.

## Assumptions

- Popular places come from the same place provider as feature 004 (Google), through the same
  server-side relay, so no key reaches the browser. "Popular" means well-rated places with many
  reviews in the city, as ranked by the provider.
- Up to 20 per group keeps cost and scrolling reasonable; paging or "load more" is out of scope.
- Photos, opening hours, prices and reviews text are out of scope.
- Filtering inside Popular (beyond the Things to do / Food split) is out of scope.
- The quick-add line takes over search's job (narrowing by name), so no separate search box is
  needed.
- The "Not yet placed" filter keeps its meaning (items with no events).
- No new account or permission is needed; device location is not used (the trip's city is).
