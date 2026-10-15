# Feature Specification: Map Locations for Items

**Feature Branch**: `feature/004-map-locations`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "I want to integrate locations with google maps. Usually a trip
planning will have to go to a location (and definitely food places), so I want it integrated
into the activities being added. I think I would still want the dfeault to be user-created
activities, but the ability to put in like restaruants or locations or places would be good. If
the user puts in something like "Chelsea Market" it should be replacable (suggested) with the
Google Maps location. whatever map app is fine, I think some apps do the option to open in
google maps/apple maps/waze?"

## Clarifications

### Session 2026-10-15

- Q: Should this feature include an in-app map of linked items, or only linking items to places
  and opening them in an outside map app? → A: No in-app map. Link to places and "Open in maps"
  only; a map view can be a later feature.
- Q: When should place suggestions appear: live while typing, a "Did you mean…?" prompt after
  saving, or only on a "Find place" button? → A: Live list under the name field while typing;
  ignoring it saves plain text.
- Q: Can the trip's location be set when creating the trip, or come from its title? → A: An
  optional Location field on the new-trip form that proposes a match for the title ("Use Kyoto,
  Japan"); the traveler picks it, searches another, or leaves it blank. Never set silently.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get a place suggestion while typing an item (Priority: P1)

The traveler adds an item the way they do today: by typing a name such as "Chelsea Market".
While they type, a short list of matching real-world places appears under the name field,
nearest to the trip's location first. The list is a suggestion, not a requirement. The
traveler can pick a place, or ignore the list and save the item as plain text, exactly as
before.

Picking a place replaces the typed name with the place's name and links the item to that
place. The item then shows the place's short address. If the place is a restaurant, café, bar
or other food spot, the item's type is set to Food (the traveler can change it back).

**Why this priority**: This is the feature. Most of a trip is going somewhere, and linking an
item to a real place is what makes the later steps (directions, opening in a map app) possible.

**Independent Test**: Create a trip located in New York, type "Chelsea Market" as a new item,
pick the first suggestion, save. The item shows "Chelsea Market" with its street address and
is linked to the place. Type "Rest day" instead, ignore the suggestions, save: the item is a
plain, unlinked item as before.

**Acceptance Scenarios**:

1. **Given** a trip with a location, **When** the traveler types at least 3 characters into
   a new item's name, **Then** up to 5 matching places appear, ordered by relevance to the
   trip's location.
2. **Given** suggestions are showing, **When** the traveler picks one, **Then** the item's name
   becomes the place's name, the item is linked to the place, and its address is shown.
3. **Given** suggestions are showing, **When** the traveler presses Enter, clicks Save, or
   dismisses the list without picking, **Then** the item is saved with the typed name and no
   linked place.
4. **Given** the traveler picks a food place, **When** the item is saved, **Then** its type is
   Food unless the traveler changed it.
5. **Given** place search is unavailable (offline, not configured, or failing), **When** the
   traveler types a name, **Then** no suggestions appear, a quiet "Place search unavailable"
   note is shown, and adding the item works exactly as before.

---

### User Story 2 - Open a linked place in a map app (Priority: P1)

From any linked item, in the item list or on the schedule grid, the traveler chooses "Open in
maps" and picks Google Maps, Apple Maps or Waze. The chosen app (or its website, if the app
isn't installed) opens on that place, ready for directions.

**Why this priority**: Getting to the place is the payoff the user asked for. Without it, a
linked place is just a nicer label.

**Independent Test**: Link an item to "Chelsea Market", choose "Open in maps", then
"Google Maps": Google Maps opens on Chelsea Market. Repeat with Apple Maps and Waze.

**Acceptance Scenarios**:

1. **Given** a linked item, **When** the traveler opens its menu, **Then** an "Open in maps"
   action offers Google Maps, Apple Maps and Waze.
2. **Given** the traveler picks a map app, **When** the app is installed on their device,
   **Then** it opens on the place; **when** it is not, **Then** the provider's website opens
   on the place in a new tab.
3. **Given** the traveler picked a map app before, **When** they choose "Open in maps" again,
   **Then** their last choice is listed first.
4. **Given** an unlinked item, **When** the traveler opens its menu, **Then** no "Open in maps"
   action is shown.
5. **Given** place search is unavailable, **When** the traveler opens a linked item in a map
   app, **Then** it still works, using the place details saved on the item.

---

### User Story 3 - Link, change or remove a place on an existing item (Priority: P2)

The traveler edits an item created before this feature, or one saved as plain text, and links
it to a place using the same suggestions. They can also swap a linked place for another, or
remove the link and keep the item as plain text.

**Why this priority**: Existing trips already have many plain items. Linking them later keeps
this feature useful for those trips, not just new ones.

**Independent Test**: Edit an existing plain item "Joe's Pizza", pick a suggestion: it becomes
linked. Choose "Remove place": it is plain again, keeping its current name and notes.

**Acceptance Scenarios**:

1. **Given** a plain item, **When** the traveler edits its name, **Then** the same place
   suggestions appear and picking one links it.
2. **Given** a linked item, **When** the traveler picks a different suggestion, **Then** the
   item links to the new place.
3. **Given** a linked item, **When** the traveler chooses "Remove place", **Then** the link and
   address are removed, the name and notes stay, and the action can be undone.
4. **Given** a linked item, **When** the traveler renames it (e.g. "Chelsea Market lunch"),
   **Then** the place link stays and the new name is kept.

---

### Edge Cases

- **Trip has no location**: suggestions still appear, just not ordered by nearness to the trip.
- **No matches**: the list says "No places found" and the typed name can be saved as normal.
- **Same place used twice** (e.g. a café visited on two days): each item or placement keeps its
  own link; nothing is merged.
- **Copying or moving**: a placement copied from a linked item keeps the place link, the same
  way it keeps the name and notes today. Changing the place on one copy does not change the
  others, matching how other fields behave.
- **Undo**: linking, changing and removing a place are each undoable, like other edits.
- **Place closed or changed later**: the item keeps the details saved when it was linked; the
  app does not re-check places in the background.
- **Typing fast**: suggestions update as the traveler types but never block typing or saving.
- **Existing "link" field**: an item's existing web link (e.g. a booking page) is unchanged and
  separate from its place.
- **Map app on desktop**: Apple Maps and Waze open their websites; a desktop browser never
  shows an error for a missing app.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Adding an item MUST still default to a plain, user-typed item. A place link MUST
  be optional and only added when the traveler picks a suggestion.
- **FR-002**: When the traveler types 3 or more characters into an item's name (on create or
  edit) and pauses typing briefly, the system MUST show a live list of up to 5 matching
  real-world places under the name field, each showing name and short address. The list MUST
  NOT block typing or saving, and there is no separate prompt after saving.
- **FR-003**: Suggestions MUST favor places near the trip's location (or the day's location
  override, when adding from a specific day) when one is set.
- **FR-004**: Picking a suggestion MUST set the item's name to the place's name and link the
  item to that place, saving the place's name, address, coordinates, category and the
  provider's place identifier on the item.
- **FR-005**: If the picked place is a food establishment (restaurant, café, bar, bakery or
  similar), the system MUST set the item's type to Food. The traveler MUST be able to change it.
- **FR-006**: Linked items MUST show the place's short address wherever the item's details are
  shown, and a place marker on the compact grid chip, so linked and plain items can be told
  apart (icon and text, not color alone).
- **FR-007**: Linked items MUST offer an "Open in maps" action with Google Maps, Apple Maps and
  Waze. It MUST open the native app when available and the provider's website otherwise.
- **FR-008**: The system MUST remember the traveler's last-chosen map app on that device and
  list it first.
- **FR-009**: Travelers MUST be able to link, change and remove a place on any existing item or
  placement. Removing a place MUST keep the name, type and notes.
- **FR-010**: Linking, changing and removing a place MUST be undoable.
- **FR-011**: Placements created by copying or moving a linked item MUST carry the place link,
  consistent with how the other item fields are copied today.
- **FR-012**: When place search is unavailable, slow or not configured, item creation and
  editing MUST work unchanged, and the system MUST show a quiet "Place search unavailable" note
  instead of suggestions. Saved place links and "Open in maps" MUST keep working.
- **FR-013**: Suggestions MUST credit the place-data provider as its terms require.
- **FR-014**: Only the text typed into the name field (and the trip's general location, for
  ordering) MUST be sent to the place-search provider. No other trip data is sent.
- **FR-015**: Any key needed for place search MUST NOT be included in the app delivered to the
  browser or committed to the repository.
- **FR-016**: The new-trip form MUST offer an optional trip location (the same city search used
  for weather) and MUST propose a match for the trip title, ignoring years and trip words such
  as "trip" or "vacation". The proposal MUST only apply when the traveler accepts it, and a
  failed lookup MUST NOT block creating the trip.

### Key Entities

- **Place**: A real-world location picked from search. Has a display name, short address,
  coordinates, a category (used to detect food places), the provider's place identifier and
  the provider's name. Stored as a snapshot on the item; not re-fetched.
- **Item** (existing): Gains an optional linked Place. Unchanged otherwise.
- **Placement** (existing): Gains an optional linked Place, copied from its source item like
  the other fields.
- **Map app preference**: The traveler's last-chosen map app, stored per device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A traveler can turn a typed "Chelsea Market" into a linked place in 2 actions or
  fewer (type, pick) and under 10 seconds.
- **SC-002**: Suggestions appear within 1 second of the traveler pausing typing in 95% of
  searches on a normal connection.
- **SC-003**: Adding a plain item takes no more steps than it does today.
- **SC-004**: From a linked item, the traveler reaches the place in their chosen map app in 3
  actions or fewer (menu, Open in maps, app).
- **SC-005**: With place search switched off, 100% of existing item create, edit, copy and move
  flows still work.
- **SC-006**: For well-known places searched by name within the trip's city (e.g. "Chelsea
  Market" in New York), the intended place is in the top 3 suggestions at least 90% of the time.

## Assumptions

- The place-search provider is Google Places, matching the user's request. Per constitution
  Principle IV it sits behind an adapter so another provider could be swapped in later.
- Map apps covered are Google Maps, Apple Maps and Waze, since the user named them. Others are
  out of scope.
- An in-app map view (showing items as pins on a map, per day or per trip, or routes between
  them) is out of scope for this feature (confirmed in Clarifications); it may be a later
  feature built on the linked places.
- Travel time or distance between items is out of scope.
- Place details are saved once when linked and not refreshed; showing live hours, ratings,
  photos or reviews is out of scope.
- The traveler's device location is not used. Ordering uses the trip's (or day's) location
  only, so no location permission is requested.
- Place search costs money per request. Searches start after 3 characters and a short typing
  pause to limit cost; quota and cost limits will be set in the plan.
- The existing weather feature's trip and day locations are reused for ordering suggestions;
  they are not changed by this feature.
