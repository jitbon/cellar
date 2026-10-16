# Feature Specification: Header Tweaks

**Feature Branch**: `feature/008-header-tweaks`

**Created**: 2026-10-16

**Status**: Implemented

**Input**: User description: "1. I want the title of the trip to be renamable on clicking on the
title, not as a separate three-dot menu. 2. Instead of having the city name twice, why not
either have it on the banner and clickable to change it." Later: "If you're greying out the cells
that are before arrival/after departure, they should be disabled and not say '+add'?"

Small change to existing controls; no new data or services, so no separate plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rename a trip by clicking its name (Priority: P1)

On the trip page, clicking the trip name in the header turns it into a text field. Enter or
leaving the field saves; Escape cancels; the change can be undone.

**Acceptance Scenarios**:

1. **Given** the trip page, **When** the name is clicked, **Then** a focused field holds the name.
2. **When** a new name is typed and Enter pressed (or focus leaves), **Then** the trimmed name is
   saved, synced and undoable.
3. **When** Escape is pressed, **Then** nothing changes.
4. **When** the name is unchanged, **Then** nothing is saved; **when** it is invalid (empty),
   **Then** the error shows and the field stays open.

### User Story 2 - The city shows once, on the banner (Priority: P1)

While the city banner shows, the city name on it is the button that changes the trip location,
and the header's location chip is left out. The city and trip progress show on the banner at
once; the photo, its credit and "Change photo" join when the photo arrives.

**Acceptance Scenarios**:

1. **Given** a located trip with the banner showing, **Then** the header has no location chip and
   the banner's city opens the trip location dialog.
2. **Given** the banner is hidden, or the trip has no photo, **Then** the header chip is back.
3. **Given** a trip without a location, **Then** the "Add a location" chip shows.
4. **Given** the photo is still loading, **Then** the banner already shows the city button and
   progress text.

### User Story 3 - Cells outside the travel window are disabled (Priority: P1)

Cells before a day's arrival or after its departure (already greyed with a plane marker) take
nothing new: no "+ Add", no drops, and they cannot be picked in "Place in a block". Events
already there stay visible, dimmed, and can still be moved out, edited or removed; to plan in
those slots the traveler changes the arrival or departure.

**Acceptance Scenarios**:

1. **Given** a day arriving at Lunch, **Then** its Morning, Breakfast and Late morning cells show
   no "+ Add", and dropping an item or event there places nothing.
2. **Given** "Place in a block", **Then** those blocks are disabled for that day and marked
   "(outside travel window)".
3. **Given** an event already in a greyed cell, **Then** it can still move to an open cell or be
   reordered within its cell.

## Requirements *(mandatory)*

- **FR-001**: The trip name in the trip page header MUST be editable in place (click or keyboard),
  saving with Enter or blur, cancelling with Escape, through the existing undoable rename.
- **FR-002**: While the city banner is shown, the city MUST appear only on the banner, as the
  button that changes the location; otherwise the header location chip MUST show.

- **FR-003**: Cells outside a day's travel window MUST NOT accept new events by typing, dragging
  (list items, Popular cards, events) or "Place in a block"; events already there MUST stay
  movable. This replaces feature 001's "greyed cells still accept placements" (FR-006a).
- **FR-004**: A mouse or touch drop MUST land only on the cell under the pointer (no
  nearest-cell fallback); keyboard drags keep their existing behavior.

## Assumptions

- Trip cards on "Your trips" keep "Rename" in their ⋯ menu: the card title is the link that opens
  the trip, so it cannot also be an edit field.
- Trip settings still offers the name field too.
