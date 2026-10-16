# Feature Specification: Day Weather Summary

**Feature Branch**: `feature/009-day-weather-summary`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "put a small weather summary for each day in the top cell, something
short like "sunny all day" or "cloudy, PM showers" etc"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See each day's weather in a few words (Priority: P1)

Each day's header (the top cell of its column) shows a short phrase describing that day's weather,
such as "Sunny all day", "Cloudy, PM showers" or "Rain, clearing PM". The traveler can read the
week's weather at a glance without hovering over individual cells (feature 002's per-cell icons
stay as they are).

**Why this priority**: This is the whole feature: a quick read of each day to decide what goes
where.

**Independent Test**: Open a located trip with days inside the forecast range: each day header
shows a short phrase that matches the hourly forecast (e.g. a day with sun until noon and rain
from 2 pm reads "Sunny, PM rain").

**Acceptance Scenarios**:

1. **Given** a day with clear skies in every daytime hour, **Then** its header reads
   "Sunny all day".
2. **Given** a cloudy day with rain likely only in the afternoon, **Then** it reads
   "Cloudy, PM showers" (or "Cloudy, PM rain" when the rain is heavier).
3. **Given** a day that is rainy in the morning and dry later, **Then** it reads
   "Rain, clearing PM".
4. **Given** a day with rain likely most of the daytime, **Then** it reads "Rain all day".
5. **Given** a day in the forecast range for a multi-city trip, **Then** the summary uses that
   day's location (its override, if any).

---

### User Story 2 - More detail on demand (Priority: P2)

Hovering, focusing or tapping the summary shows the day's high and low temperature and the
highest chance of rain, with the forecast time ("Forecast as of 09:00").

**Why this priority**: Useful context, but the phrase alone delivers the main value.

**Acceptance Scenarios**:

1. **Given** a summary, **When** the traveler hovers, focuses or taps it, **Then** the high, low
   (in the traveler's temperature unit), the day's highest rain chance and "Forecast as of HH:MM"
   appear.
2. **Given** keyboard use, **Then** the summary can be focused and its detail read.

### Edge Cases

- **Day beyond the forecast range**: no summary; the existing "Forecast from <date>" stays.
- **Day already in the past**: no summary.
- **Trip or day without a location, or weather unavailable**: no summary; nothing else changes.
- **Mixed weather that fits no rule**: the most common daytime condition, e.g. "Partly cloudy".
- **Snow, fog, thunderstorms**: their own words ("Snow", "Fog early", "PM storms").
- **Narrow screens**: the phrase stays on one line and is cut with an ellipsis; the full phrase is
  available on hover/focus/tap.
- **Night**: only daytime hours count, so overnight rain alone does not label a day rainy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each day header inside the forecast range MUST show a weather phrase of at most 24
  characters, using the same forecast and location as that day's cell icons (feature 002).
- **FR-002**: The phrase MUST be built from daytime hours (07:00–21:59 local to the day's
  location) by fixed rules: a main condition (Sunny, Partly cloudy, Cloudy, Fog, Rain, Snow,
  Storms) plus at most one change by part of day (AM = 07:00–11:59, PM = 12:00–17:59,
  evening = 18:00–21:59), e.g. "Cloudy, PM showers", "Rain, clearing PM", "Sunny all day".
- **FR-003**: "Showers" MUST be used for a likely-but-light rain period and "rain" for heavier or
  longer rain, with a rain chance of at least 50% counting as likely.
- **FR-004**: The phrase MUST be text (not color or icon alone) and readable by assistive
  technology as part of the day header.
- **FR-005**: Hover, focus or tap on the phrase MUST show the day's high/low, highest rain chance
  and forecast time.
- **FR-006**: Days outside the forecast range, in the past, without a location, or when weather is
  unavailable MUST show no phrase and keep their existing header content.
- **FR-007**: The summary MUST NOT make any extra weather requests beyond what the cell icons
  already use.

### Key Entities

- **Day weather summary**: For one day and location: the phrase, the high and low temperature,
  the highest rain chance, and the forecast time. Derived from the existing hourly forecast;
  not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For days in range, the traveler can tell each day's weather from the headers alone,
  without opening any cell detail.
- **SC-002**: Every phrase fits on one line in the day header at desktop width (24 characters
  or fewer).
- **SC-003**: Summaries appear as soon as the cell icons do, with no extra wait and no extra
  weather requests.
- **SC-004**: For a fixed set of sample forecasts (sunny, AM rain, PM showers, all-day rain, snow,
  fog, mixed), the phrases match the expected wording 100% of the time.

## Assumptions

- The phrase is in English, like the rest of the app.
- Temperatures follow the existing unit rule from feature 002 (°F for US locales, else °C).
- Daytime is fixed at 07:00–21:59; it does not follow each trip's block windows.
- The existing per-cell weather icons and their popovers are unchanged.
