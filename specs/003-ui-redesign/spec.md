# Feature Specification: Professional UI Redesign

**Feature Branch**: `feature/003-ui-redesign`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "The UI is extremely clunky. The whole app design feels like a basic
react-y app, like a vibe-coded app. I want it to look like a professional planning app, one that
prioritizes cleanliness. Right now the icons are too large, the text is too big, everything is
spaced weird, and when I create an event in a space it throws the whole column/row off. On the top
as well, the 'travel' and 'location' are way too large and not really the best UI to have. I want
it to look something like an airline (United, Delta) or hotel booking. The form should also feel
free, like having the task kind of hover over your mouse when you drag it across the screen. If
this requires a whole revamp into something like iOS/Swift or some other language that's ok, do
extensive research on it."

## Current State (observed 2026-10-14, 1440 × 900 desktop)

- A single placement card is ~90 px tall: drag handle, type badge, and four action buttons are
  always visible above the name. One placement doubles a row's height; two triple it.
- Day headers stack weekday, ISO date, and underlined "Travel…" and "Location…" links (~160 px).
- Every empty cell shows a dashed "+" box; block labels break mid-word ("Aftern oon") next to
  three always-visible icon buttons.
- The "Activities & food" add form is permanently open and takes ~25% of the width; only three
  day columns fit.
- Emoji icons (📅 📍 🎟), large body text, and inconsistent spacing.
- Dragging moves the card in place; there is no lifted "card under the cursor" feel.

## Clarifications

### Session 2026-10-14

- Q: Which platform should the redesign target? → A: Redesign the existing web app. The
  clunkiness comes from design choices, not the web platform; a native app (later, likely
  reusing the shared core) is a separate feature.
- Q: What happens when a cell has many events? → A: Rows grow to fit up to 3 chips; a cell
  with 4+ events shows 2 chips and "+N more", which opens the cell's full list.
- Q: Which visual direction? → A: Airline (navy, white, crisp sans-serif, dense), chosen from
  the three mockups. Block labels show the name only, without time ranges.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A calm, compact schedule grid (Priority: P1)

The traveler opens a trip and sees a clean, compact grid that reads like an airline itinerary:
small, consistent type; thin dividers; quiet empty cells; and compact one-line event chips. Adding
events never makes the layout jump unpredictably.

**Why this priority**: The grid is where the traveler spends almost all their time, and it is the
source of most complaints (sizes, spacing, rows jumping).

**Independent Test**: Open a 5-day trip with 0, 1, 3, and 6 events in different cells on a
1440 px screen; confirm at least 5 days are visible, every event is a one-line chip, and adding an
event to a cell does not change any other column's width.

**Acceptance Scenarios**:

1. **Given** a trip on a 1440 × 900 screen with the item list closed, **When** the traveler opens
   it, **Then** at least 5 day columns and at least 8 blocks are visible without scrolling.
2. **Given** an empty cell, **When** the traveler is not pointing at or focused on it, **Then** it
   shows no "+" box or border clutter; pointing at or focusing it reveals a subtle "Add" affordance.
3. **Given** a placement, **When** it is displayed, **Then** it is a single-line chip showing a
   small type icon and its name (truncated with full name on hover/focus); its actions (switch
   type, move, edit, remove) are not visible until the chip is hovered, focused, or opened.
4. **Given** a row whose cells hold 0–2 events, **When** the traveler adds an event to one cell,
   **Then** no column changes width, and the row grows by at most one chip height.
7. **Given** a cell with 4 or more events, **When** displayed, **Then** it shows the first 2 chips
   and a "+N more" control (so it never shows more than 3 lines); activating "+N more" opens the
   cell's full list, where every event can be edited, reordered, and dragged out, and which is a
   valid drop target.
8. **Given** a row, **When** its busiest cell has 1, 2, or 3 events, **Then** the row is 1, 2, or
   3 chip-lines tall; no row is ever taller than 3 chip-lines.
5. **Given** a block label, **When** displayed, **Then** the full name fits on one line at desktop
   widths and never breaks mid-word at any width; reorder/add/remove/time-window controls appear on
   hover/focus or in a menu.
6. **Given** the weather icons from 002, **When** shown, **Then** they are small, monochrome-style
   glyphs that sit inside the chip area of the cell without adding a row.

---

### User Story 2 - Compact day and trip headers (Priority: P1)

Day headers read like a flight segment: weekday and short date ("Thu, Oct 15") on one line, with
travel (arrive/depart) and location shown as small inline indicators only when set, and edited
from a single compact menu. The trip header is one slim bar: back, trip name, dates, location,
undo/redo, settings.

**Why this priority**: The user called out "Travel" and "Location" as too large; the header is
the first thing seen.

**Independent Test**: View a trip where Day 1 has an arrival block and Day 3 has a location
override; confirm each day header is ≤ 2 lines, shows "✈ Arrive · Lunch"-style and "📍 Osaka"-style
indicators only on those days (as icons + short text), and both are editable from one day menu.

**Acceptance Scenarios**:

1. **Given** a day with no travel or location override, **When** displayed, **Then** its header is
   one line (weekday + short date) plus a day-menu button; no "Travel…" or "Location…" text.
2. **Given** a day with an arrival, departure, or location override, **When** displayed, **Then** a
   small icon + short label indicator appears under the date; it is keyboard-reachable and opens the
   day menu.
3. **Given** the day menu, **When** opened, **Then** the traveler can set/clear arrival, departure,
   and location for that day in one place.
4. **Given** the trip header, **When** displayed, **Then** it is a single slim bar whose height is
   no more than that of one block row, containing back, name, date range, location, undo/redo, and
   settings; one-time tips appear as a dismissible toast, not a full-width banner.

---

### User Story 3 - Drag that feels free (Priority: P1)

When the traveler drags an event (or a list item), a lifted copy of the chip floats under the
pointer with a soft shadow, the original spot shows a faint placeholder, and the target cell
highlights; dropping animates the chip into place.

**Why this priority**: Explicitly requested; drag is the core planning gesture.

**Independent Test**: Drag a chip from Day 1 / Lunch to Day 4 / Dinner with a mouse, and on a
touch screen after a long-press; confirm the chip follows the pointer the whole way, the target
highlights, and it settles into the new cell.

**Acceptance Scenarios**:

1. **Given** a chip, **When** the traveler starts dragging, **Then** a lifted copy follows the
   pointer within one frame, slightly enlarged with a shadow, and stays fully visible over all other
   content including the item panel.
2. **Given** a drag in progress, **When** the pointer is over a cell, **Then** that cell highlights
   and shows where the chip will land among existing chips.
3. **Given** a drag in progress, **When** the pointer nears the grid edge, **Then** the grid
   auto-scrolls.
4. **Given** a drop, **When** released, **Then** the chip animates into its new position; Escape
   cancels and returns it to its origin.
5. **Given** the system's "reduce motion" setting, **When** dragging, **Then** animations are
   minimized while the floating chip still follows the pointer.
6. **Given** keyboard-only use, **When** moving a chip, **Then** the existing keyboard move still
   works and announces the target.

---

### User Story 4 - Item list as a slide-in panel (Priority: P2)

The "Activities & food" list is a collapsible side panel (bottom sheet on phones): a compact list
of chips with search and filters, and an "Add" button that opens a small form, instead of a
permanently open form.

**Why this priority**: Frees grid space; secondary to the grid itself.

**Independent Test**: Toggle the panel; confirm the grid widens when closed, items can still be
dragged from the open panel into cells, and adding an item happens in a small popover/sheet.

**Acceptance Scenarios**:

1. **Given** the planner, **When** the panel is closed, **Then** the grid uses the full width; the
   panel's open/closed state is remembered per device.
2. **Given** the open panel, **When** the traveler clicks "Add", **Then** a compact form opens
   (name, type, notes, link) and closes after adding.
3. **Given** the panel, **When** the traveler types in its search, **Then** items filter by name;
   the existing type/placed filters remain as compact segmented controls.

---

### User Story 5 - Consistent look across the whole app (Priority: P2)

Sign-in, sign-up, password reset, trip list, and settings use the same visual language: a clean
airline/hotel-booking style with one accent color, a compact type scale, consistent icons, and
consistent spacing.

**Why this priority**: Professional feel requires consistency, but the planner matters most.

**Independent Test**: Visit every screen; confirm the same type scale, icon set, button styles,
and accent color appear everywhere, and no emoji are used as interface icons.

**Acceptance Scenarios**:

1. **Given** any screen, **When** displayed, **Then** it uses only the shared type scale (no more
   than 5 text sizes app-wide), one icon set at consistent sizes, and the shared spacing scale.
2. **Given** the trip list, **When** displayed, **Then** trips appear as clean itinerary-style
   cards or rows (name, dates, location, days) like a booking confirmation list.
3. **Given** any screen, **When** displayed, **Then** it follows the Airline direction: white
   surfaces, a deep navy accent (the trip header is a navy bar), a crisp sans-serif with small
   uppercase labels for block names and weekdays, thin gray dividers, and the densest spacing of
   the options reviewed. The current burgundy accent is retired. Reference mockup: "Cellar Design
   Directions", option A (https://claude.ai/artifact/JWu8yKVQD9fPnqpPfYra7U).

---

### Edge Cases

- Very long event or block names → truncated with ellipsis; full name on hover, focus, and in the
  edit view; never wraps mid-word.
- A cell with many events (e.g. 8) → 2 chips + "+6 more"; the count is always visible, so no
  event is hidden without indication. Dragging onto a collapsed cell inserts at the end unless
  the full list is open.
- Phone width (360 px) → one day at a time, block labels on one line (abbreviated if needed with
  full name accessible), item panel as a bottom sheet, drag via long-press with the floating chip.
- Greyed (outside arrival/departure) cells → still visibly distinct with a non-color marker,
  matching the new style.
- Dark mode → all screens have a matching dark theme meeting AA contrast.
- Drag onto the item panel or outside the grid → cancels and the chip returns home.
- Touch-and-scroll vs touch-and-drag → a short touch scrolls; long-press starts a drag.
- Weather icons, travel indicators, and type icons together in one cell → stay legible and do not
  push chips onto a new line.

## Requirements *(mandatory)*

### Functional Requirements

**Platform**

- **FR-001**: The redesign MUST target the existing web app (desktop and phone browsers). A native
  mobile app is out of scope and remains a later, separate feature.
- **FR-002**: All existing functionality from 001 and 002 MUST keep working (no feature removed);
  this feature changes presentation and interaction feel, not planning rules or data.

**Grid**

- **FR-003**: Events MUST display as single-line chips (type icon + name) whose actions are hidden
  until hover, focus, or tap.
- **FR-004**: Column widths MUST NOT change when events are added or removed. A row MUST be as
  tall as its busiest cell up to 3 chip-lines; a cell with 4+ events MUST show 2 chips plus a
  "+N more" control that opens the full, editable, droppable list for that cell.
- **FR-005**: Empty cells MUST be visually quiet, revealing an "Add" affordance on hover/focus;
  typing into a cell (001 FR-007) MUST still work with one click/tap.
- **FR-006**: Block labels MUST show only the block name, on one line without mid-word breaks.
  Block time windows (002) MUST NOT be printed on the grid; they stay editable from the block's
  menu. Block controls MUST move into hover/focus reveal or a menu.
- **FR-007**: At 1440 px width with the item panel closed, at least 5 days and 8 blocks MUST be
  visible; with it open, at least 4 days.

**Headers**

- **FR-008**: Day headers MUST show weekday and short date on one line, with travel and location
  shown only as small indicators when set, editable from a single day menu.
- **FR-009**: The trip header MUST be a single slim bar; one-time tips MUST be dismissible toasts.

**Drag**

- **FR-010**: Dragging MUST show a lifted floating copy of the chip following the pointer, a
  placeholder at the origin, target-cell highlighting with insertion position, edge auto-scroll,
  animated drop, and Escape to cancel, on both mouse and touch (long-press).
- **FR-011**: Motion MUST respect the user's reduced-motion setting.

**Item panel**

- **FR-012**: The item list MUST be a collapsible side panel (bottom sheet on phones) with
  search, compact filters, and an "Add" action that opens a small form; open/closed state is
  remembered per device.

**Visual system**

- **FR-013**: The whole app MUST use one shared visual system: a compact type scale (≤ 5 sizes),
  one icon set (no emoji as interface icons), one spacing scale, one accent color, consistent
  radius and elevation, in light and dark themes.
- **FR-014**: The redesign MUST continue to meet WCAG 2.1 AA (contrast, keyboard access, labeled
  controls, visible focus) and work from 360 px wide (constitution II).

### Key Entities

No new data. Per-device UI preferences only:

- **UI Preferences (per device)**: item panel open/closed; one-time tips dismissed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1440 × 900, at least 5 days × 8 blocks are visible at once (today: 3 days).
- **SC-002**: Adding a 1st, 2nd, or 3rd event to a cell changes no column width, and a single
  event chip is no taller than one line of text plus padding (≤ 32 px).
- **SC-003**: During a drag, the floating chip stays under the pointer for the entire gesture
  with no visible lag at 60 frames per second on a typical laptop.
- **SC-004**: Day headers are at most 2 lines tall; the trip header is at most one block-row tall.
- **SC-005**: No screen uses more than 5 text sizes or any emoji as an interface icon.
- **SC-006**: All 001/002 automated end-to-end scenarios still pass after the redesign.
- **SC-007**: Automated accessibility scans report zero violations on all screens, light and dark.
- **SC-008**: The primary user rates the app as looking "professional, like a booking app" and
  prefers it over the current design in a side-by-side review.

## Assumptions

- This feature changes presentation and interaction only: no new planning features, data, or
  integrations.
- The existing domain logic and data stay as they are and are reused unchanged.
- Visual references (United, Delta, hotel booking sites) guide the feel; Cellar does not copy
  their branding, logos, or proprietary assets.
- The layout is dense. Constitution v1.1.0 (amended 2026-10-14) changed Principle II's visual
  language from "soft, generous spacing" to dense and professional (compact spacing scale, small
  radii, compact type scale, one accent).
- Platform was decided in clarification (web). `/speckit-plan` researches the web techniques
  needed (drag overlay, icon set, type scale, design references).
