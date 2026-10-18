# Feature Specification: Details for Linked Places

**Feature Branch**: `feature/012-linked-place-details`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "I want the Google-Map-linked places to show the details of it (like
what we see when clicking on top places, e.g. location, open in maps, review, type, etc)"

## Context

Places from the Popular tab open a detail view (feature 007): a large photo with credit, the
place's type and address, its rating and number of reviews, where it is planned in the trip, and
actions (Place in a block, Add to my list, Open in maps). Items and events linked to a map place
(feature 004, shown with a pin) have none of this: the trip keeps only the place's name, address,
location and category, and the provider's terms do not allow keeping ratings or photos.

This feature gives linked list items and linked schedule events the same detail view, filling in
the rating, reviews, type and photo from the place provider when the view opens.

## Clarifications

### Session 2026-10-18

- Q: Should the details view also show opening hours, phone and website, or only what Popular
  shows today? → A: Add today's opening hours (full week on expand) and a website link, in both
  the linked-place and Popular detail views; no phone number.
- Q: On the schedule, how should someone open a linked event's details? → A: "View details" in the
  event's menu; clicking the event still opens the edit dialog.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a linked list item's details (Priority: P1)

A traveler added "Chelsea Market" to My list by picking the map suggestion. They open its details
from the list and see the same view as a Popular card: photo, "Market · 75 9th Ave", "4.6 (31,204
reviews)", where it is planned, and Open in maps.

**Why this priority**: My list is where people collect and compare places before placing them;
seeing type, rating and photo there is the main value.

**Independent Test**: Add a linked item to My list, open its details: the view shows the photo,
type, address, rating with review count, planned dates (or "Not planned yet"), Open in maps, and
Place in a block.

**Acceptance Scenarios**:

1. **Given** a linked item in My list, **When** the traveler chooses "View details" from its menu
   or clicks its name, **Then** a detail view opens with the place's name, address and Open in maps
   immediately, and its photo, type, rating and review count as soon as they arrive.
2. **Given** the view is open, **When** the traveler chooses "Place in a block", **Then** the usual
   block picker opens for that item, as from the item's menu.
3. **Given** the item is placed on two days, **Then** the view lists both ("Planned: Mon May 3 ·
   Lunch, Wed May 5 · Dinner"), as Popular's view does.
4. **Given** an item that is not linked to a place, **Then** it has no "View details" and clicking
   its name does nothing new.

---

### User Story 2 - See a linked event's details from the schedule (Priority: P2)

On the schedule, a traveler sees "Chelsea Market" at Lunch on Tuesday with a pin and wants to check
its rating or photo before going. They open its details from the event's menu.

**Why this priority**: Useful on the day, but the list (US1) is where most comparing happens.

**Independent Test**: Place a linked item on the schedule, open the event's menu, choose "View
details": the same view opens.

**Acceptance Scenarios**:

1. **Given** a linked event, **When** the traveler chooses "View details" from its menu, **Then**
   the detail view opens for that place.
2. **Given** the view opened from an event, **Then** its actions are Open in maps and "Edit event"
   (Place in a block is not offered, since it is already placed).
3. **Given** a linked event, **When** the traveler clicks the event itself, **Then** it still opens
   the edit dialog as today.

---

### User Story 3 - Details when the provider is unavailable (Priority: P2)

When the place provider is unreachable, over its daily limit, or not configured, the view still
opens with what the trip knows (name, address, category, planned dates, Open in maps) and says the
rest is unavailable.

**Why this priority**: The view must never be blank or block planning (constitution IV).

**Independent Test**: With the provider failing, open a linked item's details: name, address,
planned dates and Open in maps show, with "More details aren't available right now."

**Acceptance Scenarios**:

1. **Given** the provider fails or times out, **When** the view opens, **Then** the stored facts
   show and a short note says more details are unavailable; the photo area shows the type icon.
2. **Given** a place the provider no longer knows (closed or removed), **Then** the stored facts
   show with "This place may no longer be listed."

### Edge Cases

- The same place opened again in the same session shows its details at once without asking the
  provider again.
- A linked item and a Popular card for the same place show the same details.
- A place with no rating or no photo shows the view without those parts, as Popular does; the
  same for no hours or no website.
- Hours are for the place's own day and time zone, not the traveler's (a Tokyo place viewed from
  New York shows Tokyo's "today").
- Places open around the clock read "Open 24 hours"; hours past midnight read e.g. "18:00–02:00".
- Opening details while offline shows the stored facts and the unavailable note.
- Closing the view before details arrive cancels nothing visible and causes no error.
- The view works with keyboard only, at 360 px, and in dark mode, like Popular's.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Linked list items MUST offer "View details" in their menu and open the view when
  their name is clicked or activated with the keyboard.
- **FR-002**: Linked schedule events MUST offer "View details" in their menu; clicking the event
  MUST keep opening the edit dialog.
- **FR-003**: The view MUST match Popular's detail view: large photo with credit (or the type
  icon), type and address, rating with review count, planned dates, and Open in maps with the
  same choices as elsewhere.
- **FR-003a**: Both detail views (linked places and Popular) MUST show today's opening hours in
  the place's local time (e.g. "Open today 9:00–21:00" or "Closed today"), with the full week
  shown on expand, and a "Website" link that opens in a new tab. Either part is left out when the
  provider has none. The Popular view fetches these when it opens, like the linked-place view.
- **FR-004**: The view's actions MUST be: from a list item, Place in a block and Open in maps; from
  an event, Edit event and Open in maps.
- **FR-005**: The stored facts (name, address, category, planned dates, Open in maps) MUST show
  immediately; photo, type, rating, review count, opening hours and website MUST be fetched from
  the place provider when the view opens and appear within 2 seconds on a typical connection.
- **FR-006**: Fetched details MUST be kept for the rest of the session only (memory), never stored
  on the device or server, matching Popular (provider terms).
- **FR-007**: When details cannot be fetched, the view MUST still open with the stored facts and a
  short unavailable note; planning MUST be unaffected.
- **FR-008**: Only the place's provider identifier MUST be sent to the provider service to fetch
  details; no trip data.
- **FR-009**: Items and events that are not linked MUST NOT show "View details".
- **FR-010**: The view MUST meet WCAG 2.1 AA, work at 360 px, and be fully usable by keyboard,
  as Popular's detail view is.

### Key Entities

- **Linked place** (existing): the place stored with an item or event: provider id, name,
  address, location, category.
- **Place details** (session only): photo reference and credit, type label, rating, review count,
  weekly opening hours, website address, fetched by provider id.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From My list, a traveler reaches a linked place's rating and photo in 2 interactions
  or fewer.
- **SC-002**: Stored facts appear at once (no wait) in 100% of openings, including with the
  provider unavailable.
- **SC-003**: Reopening a place's details in the same session makes no new provider request.
- **SC-004**: Opening details never changes the trip (no edits, no sync traffic).

## Assumptions

- The existing place service can return a place's photo, type, rating and review count by id;
  each opening (once per place per session) is one more provider request, kept within the
  existing daily caps alongside Popular.
- Phone numbers and written reviews are out of scope; "review" means the rating and review count
  Popular already shows.
- Items linked before this feature work without changes (they already store the provider id).
- The detail view opened from Popular is unchanged.
