# Feature Specification: Weather Forecast on the Schedule

**Feature Branch**: `feature/002-weather-forecast`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "I want to integrate weather forecasting into this mix. Since the
weather is a huge impactor of what happens during a day I want there to be an indicator of what
the weather is like at each point in the day. I'm debating between changing the cell color to be
a different hue based on the weather (e.g. yellow for sun, blue for rain idk) or just have an
emoji/icon in a corner showing what the day will be (and when you hover over it it'll show you
the weather /forecast/percentage rain)."

## Clarifications

### Session 2026-10-14

- Q: How should weather be shown on the grid? → A: A small icon in the corner of each cell, with
  details on hover/tap. No background tint (tint-only would also violate constitution
  Principle II).
- Q: Is the location set per trip or per day? → A: One trip location, with an optional
  override on any day for multi-city trips; overridden days show it in the day header.
- Q: How does a block map to a time of day? → A: Each block has a default time window; new
  blocks get one suggested from their position; the traveler can adjust any block's window.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the weather for each block at a glance (Priority: P1)

While planning, the traveler looks at the schedule grid and sees, for each cell (day × time
block), what the weather is expected to be at that point in the day — e.g. sunny in the Morning,
rain in the Afternoon. This lets them move an outdoor activity to a dry block or put an indoor
food place in a rainy one without leaving the grid.

The indicator is a small weather icon in the corner of each cell. Cells are not tinted by
weather; the icon alone carries the condition, and details appear on hover/tap (User Story 2).

**Why this priority**: This is the feature. Weather at each point in the day is what the
traveler asked for.

**Independent Test**: Create a trip whose dates fall within the next few days at a known
location; confirm each in-range cell shows a weather indicator and that cells with different
expected conditions show different indicators.

**Acceptance Scenarios**:

1. **Given** a trip at a location with dates inside the forecast range, **When** the traveler
   opens the schedule, **Then** every cell in that range shows a weather indicator for that day
   and block.
2. **Given** a day forecast to be sunny in the morning and rainy in the afternoon, **When** the
   traveler views that day, **Then** the Morning and Afternoon cells show different indicators
   (sun vs rain).
3. **Given** a cell with a weather indicator, **When** the traveler looks at it, **Then** the
   condition is identifiable by icon/label, not only by color.
4. **Given** weather indicators on the grid, **When** the traveler types, drags, or edits
   placements, **Then** the indicators never block or slow those actions.

---

### User Story 2 - See forecast details on hover or tap (Priority: P1)

The traveler hovers over (desktop) or taps (touch) a cell's weather indicator to see the
details: condition (e.g. "Light rain"), temperature, chance of rain as a percentage, and when the
forecast was last updated.

**Why this priority**: The user explicitly asked for the percentage chance of rain on hover; the
icon alone is not enough to make decisions like "bring an umbrella or reschedule".

**Independent Test**: Hover over an indicator with a mouse, then tap one at phone width, and
confirm both show condition, temperature, chance of rain, and "Forecast as of <time>".

**Acceptance Scenarios**:

1. **Given** a cell with a weather indicator, **When** the traveler hovers it with a mouse,
   **Then** a detail popup shows condition, temperature, chance of rain (%), and forecast time.
2. **Given** a phone-width screen, **When** the traveler taps an indicator, **Then** the same
   details appear, and tapping elsewhere dismisses them.
3. **Given** a keyboard user, **When** they focus a cell's indicator, **Then** the same details
   are available and announced to screen readers.

---

### User Story 3 - Set where the trip is (Priority: P1)

The traveler tells Cellar where the trip takes place so the forecast is for the right place.
They set one location for the trip, and can override it on any day for multi-city trips (e.g.
Tokyo for the trip, Kyoto on Days 4–6). Days without an override use the trip location.

**Why this priority**: Trips currently have no location; without one there is no forecast to
show.

**Independent Test**: Set a trip's location to "Tokyo", confirm forecasts appear; change it to
"Reykjavik" and confirm the forecasts change.

**Acceptance Scenarios**:

1. **Given** a trip with no location, **When** the traveler opens the schedule, **Then** no
   weather indicators are shown and a gentle prompt offers to add a location.
2. **Given** the traveler types "Kyo" into the location field, **When** matching places appear,
   **Then** they can pick "Kyoto, Japan" and forecasts appear for it.
3. **Given** a trip with a location, **When** the traveler changes the location, **Then** the
   forecasts update to the new place.
4. **Given** any location change, **When** the traveler undoes it, **Then** the previous
   location and its forecasts return.
5. **Given** a trip located in Tokyo, **When** the traveler sets Day 4's location to Kyoto,
   **Then** Day 4 shows Kyoto forecasts, its day header shows "📍 Kyoto", and other days still
   show Tokyo.
6. **Given** Day 4 overrides to Kyoto, **When** the traveler clears the override, **Then** Day 4
   goes back to the trip location.
7. **Given** a day with an override, **When** the traveler changes the trip location, **Then**
   that day keeps its override; only days without one change.

---

### Edge Cases

- Trip dates beyond the forecast range (e.g. a trip 3 months away) → those cells show no
  indicator; the day header or grid notes "Forecast available from <date>" so the absence is
  explained, not mysterious.
- Trip partly in range → in-range days show forecasts; later days show the "available from"
  note.
- Trip entirely in the past → no forecast is shown.
- Weather service unavailable, slow, or not configured → the grid works normally and a small
  "Weather unavailable" label is shown; no editing is blocked (constitution Principle IV).
- Forecast fetched a while ago → the details show "Forecast as of <time>" and the forecast is
  refreshed automatically when stale (older than about 3 hours) while the trip is open.
- Greyed-out cells (before arrival / after departure) → still show weather, dimmed like the cell.
- A block added, renamed, or reordered → its cells get the right indicator for their time of
  day without extra steps. Reordering does not change a block's window; renaming does not
  either.
- A block's window crosses midnight (e.g. Night 23–2) → the forecast for those hours of that
  night is used.
- Two blocks' windows overlap or are out of order → allowed; each cell simply uses its own
  block's window.
- Location the weather service cannot find → the traveler is told no matching place was found
  and the previous location is kept.
- Phone width, one day at a time → indicators and the tap-for-details work the same.

## Requirements *(mandatory)*

### Functional Requirements

**Location**

- **FR-001**: Users MUST be able to set, change, and clear a trip's location, by searching for a
  place by name and picking a result.
- **FR-001a**: Users MUST be able to set or clear a location override on any day. A day's
  forecast uses its override if set, otherwise the trip location. A day with an override MUST
  show it in the day header (e.g. "📍 Kyoto").
- **FR-002**: Location changes MUST be undoable like other planning actions and sync to the
  user's other devices like other trip data.
- **FR-003**: When no location is set, the schedule MUST show no weather indicators and MUST
  offer a way to add a location; nothing else about planning changes.

**Weather indicator**

- **FR-004**: For each cell within the forecast range, the system MUST show a weather indicator
  representing the expected condition for that day at that block's time of day.
- **FR-005**: The indicator MUST distinguish at least: clear/sunny, partly cloudy, cloudy, rain,
  thunderstorm, snow, and fog. It MUST be identifiable by icon or label, never color alone, and
  meet WCAG 2.1 AA contrast.
- **FR-006**: Each block MUST have a time window (start and end time of day) so the indicator
  reflects that point in the day. Default blocks start with these windows: Morning 6–8,
  Breakfast 8–10, Late morning 10–12, Lunch 12–14, Afternoon 14–16, Late afternoon 16–18,
  Dinner 18–20, Dessert 20–21, Evening 21–23, Night 23–2.
- **FR-006a**: A newly added block MUST get a suggested window based on its position between
  neighboring blocks. Users MUST be able to change any block's window in its block settings;
  the change applies to all days of the trip and is undoable. Windows are only used for
  weather; they never restrict what can be placed in a block.
- **FR-007**: Cells outside the forecast range or in the past MUST show no indicator; the
  schedule MUST tell the traveler from which date forecasts will appear.

**Details**

- **FR-008**: Hovering (mouse), tapping (touch), or focusing (keyboard) an indicator MUST show
  the condition, temperature, chance of rain as a percentage, and the time the forecast was
  fetched (e.g. "Forecast as of 09:00").
- **FR-009**: Temperatures MUST be shown in °C or °F based on the traveler's locale.

**Reliability**

- **FR-010**: Forecasts MUST be cached so reopening a trip shows the last forecast immediately,
  labeled with its fetch time, and refreshed in the background when older than about 3 hours.
- **FR-011**: If forecasts cannot be fetched, the schedule MUST remain fully usable and show a
  clear "Weather unavailable" state; no planning action may wait on weather.
- **FR-012**: Only the location and dates needed for the forecast MAY be sent to the weather
  service; no placement names, notes, or other trip data.

### Key Entities

- **Trip Location**: The place forecasts are fetched for: a display name (e.g. "Kyoto, Japan")
  and its coordinates. A trip has at most one; a day has at most one override.
- **Block Time Window**: A start and end time of day on each time block (defaulted, editable),
  used to pick the right part of a day's forecast for that block's cells.
- **Forecast Snapshot**: The weather for one location, date, and time of day: condition,
  temperature, chance of rain, and the time it was fetched. Cached; not edited by the user and
  not part of undo history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A traveler can tell the expected weather for any in-range block in under
  2 seconds by looking at the grid, without opening anything.
- **SC-002**: The chance of rain for any block is reachable in one hover or one tap.
- **SC-003**: Opening a trip whose forecast was fetched before shows the cached indicators
  within 1 second, even when offline from the weather service.
- **SC-004**: When the weather service is down, 100% of planning actions still work and the
  traveler sees a clear "Weather unavailable" label.
- **SC-005**: Setting a trip's location takes under 30 seconds.
- **SC-006**: The primary user reports using the weather indicators to move at least one
  activity during real trip planning.

## Assumptions

- Forecasts cover roughly the next 7–16 days depending on the weather service; showing typical
  or historical weather for far-future dates is out of scope for this feature.
- Weather is for planning, not alerts: notifications about forecast changes are out of scope.
- The weather service is accessed through an adapter (constitution Principle IV); the provider
  is chosen during planning.
- The traveler's device location is not used; location is always chosen by the traveler.
- Forecast data is not part of undo history and is not editable.
- Times of day are in the trip location's local time zone, not the traveler's device time zone.
