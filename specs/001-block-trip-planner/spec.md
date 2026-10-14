# Feature Specification: Block-Based Trip Planner (Core)

**Feature Branch**: `001-block-trip-planner`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "create the basic core block-based trip planner, point 1" — Cellar is a
web app for planning a vacation. Time slots are organized into "blocks" like a spreadsheet. The
user builds a list of activities and food places, then copies them into blocks within a schedule
using time blocks such as "Morning", "Breakfast", "Late morning", "Lunch",
"Afternoon/Late afternoon". It should be flexible and easy to plan.

## Clarifications

### Session 2026-10-12

- Q: Should every day share the same time blocks, or can blocks differ per day? → A: All days
  share the same blocks. A day can optionally have an arrival and/or departure point; blocks
  outside that window are greyed out on that day.
- Q: Should list items have more types than Activity and Food place? → A: No, keep two types
  (check-in etc. is an Activity). Also: events can be typed directly into a cell, not only
  dragged from the list.
- Q: When typing into a cell, should matching list items be suggested? → A: Yes. Matching list
  items are suggested as you type; picking one inserts a copy (same as dragging). Typed events
  always default to Activity, regardless of block.
- Q: What happens to user data when an account is deleted? → A: Users can delete their account
  from settings; all trips are permanently removed after a 30-day grace period, and signing in
  during that period cancels the deletion.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a trip with a day × block schedule (Priority: P1)

The traveler creates a trip by giving it a name and a date range. Cellar shows a schedule grid
with one column per day and one row per time block, pre-filled with a default set of blocks
(Morning, Breakfast, Late morning, Lunch, Afternoon, Late afternoon, Dinner, Dessert, Evening, Night). The traveler can type an
event (e.g. "Walk around Shibuya") directly into any cell, as in a spreadsheet; it becomes a
placement in that cell without having to be added to the list first.

**Why this priority**: The schedule grid is the product. Without it nothing else has a place to go.

**Independent Test**: Create a trip for 4 days, confirm a 4-column grid with the default blocks
appears, type an event into one cell, reload, and confirm it persists.

**Acceptance Scenarios**:

1. **Given** no trips, **When** the traveler creates "Tokyo" from 2027-04-01 to 2027-04-05,
   **Then** a schedule appears with 5 day columns labeled with date and weekday, and the default
   block rows.
2. **Given** a trip schedule, **When** the traveler types "Walk around Shibuya" into Day 2 /
   Afternoon, **Then** it appears in that cell as an Activity placement and is still there after reopening
   the trip; it is not added to the activity & food list.
3. **Given** multiple trips, **When** the traveler opens the trip list, **Then** each trip shows
   its name and dates and can be opened, renamed, or deleted; a deleted trip can be restored
   via "Undo" right after deleting or from "Recently deleted" for 30 days.
4. **Given** a new visitor, **When** they sign up and sign in, **Then** they see their (empty)
   trip list; trips are only visible to the account that created them.
5. **Given** a trip edited on one device, **When** the traveler signs in on another device,
   **Then** the trip appears there with the same content.
6. **Given** a cell where the traveler just typed an event, **When** they press Enter and keep
   typing, **Then** another placement is added to the same cell.
7. **Given** a typed placement, **When** the traveler switches its type to Food place, **Then**
   its icon and label update in one action.
8. **Given** "Ichiran Ramen" is in the list, **When** the traveler types "ichi" into Day 2 / Lunch,
   **Then** "Ichiran Ramen" is suggested, and choosing it places a copy of the list item (Food
   place, with its notes and link) and counts toward its "placed N×".

---

### User Story 2 - Build an activity & food list and place items into blocks (Priority: P1)

The traveler keeps a per-trip list of candidate items, each either an **Activity** or a
**Food place**, with a name and optional notes and link. They drag items from the list into any
schedule cell. Dropping an item puts an independent copy in the cell (like copy/paste in a
spreadsheet): the list item stays in the list so it can be used again (e.g. the same café for two
breakfasts), and the copy in the cell can be edited on its own without affecting the list or
other cells. Placements can be dragged between cells or removed from a cell.

**Why this priority**: This is the core workflow the user does today in Google Sheets: collect
ideas, then slot them in.

**Independent Test**: Add 3 activities and 2 food places, drag one food place into Day 1 /
Breakfast and Day 3 / Breakfast, edit the Day 3 copy's note, drag an activity from Day 1 /
Morning to Day 2 / Morning, and remove one placement; confirm the grid and list reflect each
step and the Day 1 copy and list item are unaffected by the Day 3 edit.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the traveler adds "Ichiran Ramen" as a Food place, **Then**
   it appears in the list marked as food, distinct from activities.
2. **Given** a list item, **When** the traveler drags it into Day 1 / Lunch, **Then** a copy
   appears in that cell, the item still appears in the list, and the list item shows it has been
   placed (e.g. "placed 1×").
3. **Given** an item already placed in a cell, **When** the traveler drags it from the list into
   another cell, **Then** a copy appears in both cells.
4. **Given** a placement copied from the list, **When** the traveler edits its name or notes in the cell, **Then**
   only that copy changes; the list item and other copies are unchanged.
5. **Given** a list item with placements copied from it, **When** the traveler edits or deletes
   the list item, **Then** those placements are unchanged and remain in their cells.
6. **Given** a cell with a placement, **When** the traveler drags it to another cell, **Then**
   it leaves the original cell and appears in the new one.
7. **Given** a cell with multiple placements, **When** the traveler drags to reorder them,
   **Then** the new order is kept.
8. **Given** the list, **When** the traveler filters by "Food", "Activities", or "Not yet
   placed", **Then** only matching items are shown.

---

### User Story 3 - Customize time blocks (Priority: P2)

The traveler adds, renames, reorders, and removes time blocks for a trip so the schedule fits
their style (e.g. adding "Late night snack" or merging "Afternoon" and "Late afternoon").

**Why this priority**: Flexibility is a stated goal and a constitution principle, but the
defaults make the app usable before this exists.

**Independent Test**: In a trip, add a "Tea" block between Afternoon and Late afternoon,
rename "Late morning" to "Mid-morning", drag "Evening" above "Dessert", and delete an empty
block; confirm the grid updates for all days.

**Acceptance Scenarios**:

1. **Given** a trip, **When** the traveler adds a block named "Tea" after "Afternoon",
   **Then** a new row appears in that position for every day.
2. **Given** a block, **When** the traveler renames or reorders it, **Then** all days reflect the
   change and placed items stay in their (renamed/moved) block.
3. **Given** a block containing items, **When** the traveler removes it, **Then** they are warned,
   and on confirming, the placements in it are removed (list items remain in the list).
4. **Given** Day 1 of a trip, **When** the traveler sets its arrival to "Lunch", **Then** the
   Morning, Breakfast, and Late morning cells on Day 1 are greyed out, while other days are
   unaffected.
5. **Given** the last day, **When** the traveler sets its departure to "Afternoon", **Then** the
   blocks after Afternoon on that day are greyed out.

---

### User Story 4 - Undo and adjust trip dates (Priority: P2)

The traveler can undo and redo recent planning actions, and change a trip's date range without
losing work.

**Why this priority**: Planning is trial-and-error; mistakes must be cheap (constitution
Principle I).

**Independent Test**: Move an item, delete a block, then undo twice and confirm the original
state is restored; redo once and confirm the move is reapplied.

**Acceptance Scenarios**:

1. **Given** any planning action (add/move/remove placement, type or edit a placement, block change, item
   edit/delete), **When** the traveler undoes, **Then** the previous state is restored exactly.
2. **Given** a 5-day trip with items on Day 5, **When** the traveler shortens it to 4 days,
   **Then** they are warned that Day 5's placements will be removed, and can cancel.
3. **Given** a trip, **When** the traveler extends the end date, **Then** new empty days are
   appended with the trip's current blocks.

---

### Edge Cases

- A trip's start date is after its end date → creation is blocked with a clear message.
- Very long trips (e.g. 30 days) → the grid remains usable with horizontal scrolling and the
  block labels stay visible. Trips longer than 60 days cannot be created; the traveler is told
  the limit.
- Many items in one cell (e.g. 6+) → the cell grows or scrolls; no item is hidden without
  indication.
- Duplicate item names → allowed; items are distinct entries.
- Removing the last remaining block → blocked; a trip always has at least one block.
- A day's arrival block is after its departure block → not allowed; the traveler is told why.
- The block used as a day's arrival or departure is removed → that day's arrival/departure
  setting is cleared, and the traveler is told.
- Items already exist in cells that become greyed out → they stay and remain visible, dimmed.
- Phone-width screen → the traveler can view one day at a time and still place items from the
  list (constitution Principle II).
- Item with no placements and no notes → still valid; it is simply not yet placed.
- Same trip open on two devices and edited on both → changes from each device appear on the
  other; if both edit the same placement, the most recent change wins.
- Connection lost while editing → the traveler is told changes cannot be saved right now, and no
  edit is silently discarded.
- Account deleted, then the user signs in on day 29 → deletion is cancelled and all trips are
  intact; on day 31 → the account no longer exists and sign-in fails like any unknown account.
- Session expires → the traveler is asked to sign in again and returns to the same trip.

## Requirements *(mandatory)*

### Functional Requirements

**Trips**

- **FR-001**: Users MUST be able to create a trip with a name and a start and end date.
- **FR-002**: Users MUST be able to view a list of their trips and open, rename, change dates of,
  and delete any trip. An "Undo" option MUST appear right after deleting, and a deleted trip MUST
  be restorable from a "Recently deleted" section for 30 days, after which it is permanently
  removed.
- **FR-003**: When a trip's date range shrinks, the system MUST warn about placements on removed
  days before applying the change.

**Schedule grid**

- **FR-004**: The system MUST display each trip as a grid of days (columns, labeled with date and
  weekday) × time blocks (rows).
- **FR-005**: New trips MUST start with the default blocks: Morning, Breakfast, Late morning,
  Lunch, Afternoon, Late afternoon, Dinner, Dessert, Evening, Night.
- **FR-006**: Users MUST be able to add, rename, reorder, and remove blocks for a trip; block
  changes apply to every day of that trip. A trip MUST always have at least one block.
- **FR-006a**: Users MUST be able to set an optional arrival block and/or departure block on any
  day (e.g. "arrive: Lunch", "depart: Afternoon"). Blocks before the arrival block or after the
  departure block MUST be shown greyed out on that day. Greyed cells still accept placements, so the setting never blocks planning. Clearing the setting
  restores normal display. A day with an arrival or departure MUST show it visibly in the day
  header (e.g. "✈ Arrive · Lunch"), and greyed cells MUST carry a visible marker, not dimming
  alone.
- **FR-007**: Users MUST be able to type an event directly into any cell to create a placement
  there, without using the list. A typed placement defaults to type Activity, can be switched to
  Food place in one action, and is not added to the list. Pressing Enter after typing MUST start
  another placement in the same cell.
- **FR-007a**: While typing in a cell, the system MUST suggest list items whose names match the
  typed text. Choosing a suggestion MUST insert a copy of that item, exactly as dragging it from
  the list would (FR-012). Ignoring the suggestions creates a typed Activity placement.

**Activity & food list**

- **FR-008**: Each trip MUST have a list of items. Each item has a name (required), a type
  (Activity or Food place), and optional notes and link.
- **FR-009**: Users MUST be able to add, edit, and delete list items. Editing or deleting a list
  item MUST NOT change any copies already placed in the schedule.
- **FR-010**: The list MUST be filterable by type and by placed/not-yet-placed status, and each
  item MUST show how many copies of it are currently in the schedule.

**Placement**

- **FR-011**: Users MUST be able to place a list item into any cell by drag-and-drop, with
  drag-and-drop working on both mouse and touch. A keyboard-accessible equivalent MUST also
  exist (constitution Principle II).
- **FR-012**: Placing an item MUST create an independent copy in the cell (name, type, notes,
  link) and MUST NOT remove the item from the list; an item MAY be placed in any number of cells.
- **FR-013**: Users MUST be able to drag any placement to another cell, reorder placements within a
  cell, and remove a placement from a cell.
- **FR-014**: Users MUST be able to edit any placement's name, type, notes, and link; the edit MUST
  affect only that placement.

**Reliability**

- **FR-015**: Users MUST be able to undo and redo planning actions within the current session.
- **FR-016**: All changes MUST be saved automatically without an explicit save step.
- **FR-017**: Users MUST be able to create an account, sign in, and sign out. Trip data MUST be
  stored in the user's account and be available on any device where they sign in.
- **FR-018**: A user's trips MUST only be visible to and editable by that user.
- **FR-018a**: Users MUST be able to delete their account from settings after confirming. The
  account and all its trips MUST be permanently removed 30 days later; signing in before then
  MUST cancel the deletion and restore everything unchanged.
- **FR-019**: Changes made on one device MUST appear on the user's other signed-in devices
  without manual refresh; when the same field is edited on two devices, the most recent change
  wins.
- **FR-020**: If a change cannot be saved (e.g. no connection), the system MUST tell the user
  and MUST NOT silently discard it.

**Interface**

- **FR-021**: The interface MUST follow the project's clean, rounded visual style and be usable
  at phone width, with activities and food places visually distinguishable by icon and label,
  not color alone.

### Key Entities

- **User**: An account holder. Owns their trips; signs in to access them from any device.
- **Trip**: A planned vacation. Name, start date, end date. Owns its days, blocks, and item list.
- **Day**: One date within a trip. Derived from the trip's date range. Optionally records an
  arrival block and a departure block.
- **Time Block**: A named slot type (e.g. "Breakfast") with an order position. Defined per trip
  and shared by all its days.
- **Cell**: The intersection of a Day and a Time Block. Holds an ordered set of placements.
- **Item**: An entry in the trip's list. Name, type (Activity / Food place), optional notes and
  link.
- **Placement**: An event in a Cell: its own name, type, notes, and link, plus an order
  position within the cell. Created either by typing directly into the cell or by dragging an
  Item from the list (making an independent copy). A copied placement remembers which list item
  it came from only to power the "placed N×" count and filter; edits never flow between them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A traveler can create a trip and see its full schedule grid in under 1 minute.
- **SC-002**: Placing a list item into a cell takes a single drag.
- **SC-003**: A traveler can recreate an existing 5-day Google Sheets plan (about 25 items) in
  Cellar in under 15 minutes.
- **SC-004**: Every planning action can be undone, and undo restores the exact prior state in
  100% of tested actions.
- **SC-005**: No planning work is lost on closing and reopening the app; 100% of changes made
  before closing are present on reopening.
- **SC-006**: All core tasks (create trip, add item, place item, edit block) can be completed at
  phone width (360px) and with keyboard only.
- **SC-007**: A change made on one device is visible on another signed-in device within
  5 seconds under normal connectivity.
- **SC-008**: The primary user rates the planner at least as easy to use as their current Google
  Sheets workflow.

## Assumptions

- Each trip belongs to one account; sharing trips with other people is out of scope for this
  feature.
- Sign-in uses a standard method (email + password, optionally a common social login); the exact
  method is decided in planning. Password reset is included.
- Deleting a list item does not delete placements copied from it (they are independent); the
  "placed N×" count simply no longer applies.
- Trips are limited to 60 days.
- The item list is per trip (not a global library shared across trips).
- Blocks are labels, not clock times; specific times can be written in a placement's name or notes.
- Weather, maps, reviews, AI tools, and the mobile app are out of scope for this feature
  (planned as later features).
- Importing from Google Sheets is out of scope for this feature.
- Undo history covers the current session only.
- The app is used online in a modern browser; offline editing is not required for this feature.
