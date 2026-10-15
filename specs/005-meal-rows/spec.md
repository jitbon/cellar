# Feature Specification: Meal Rows

**Feature Branch**: `feature/005-meal-rows` (branched from `feature/004-map-locations`; merge after 004)

**Created**: 2026-10-15

**Status**: Implemented

**Input**: User description: "can we do some visual indicator of food rows vs activity rows, maybe
food rows is slightly different, I know that they are flexible but just for visual"

## Clarifications

### Session 2026-10-15

- Q: How should the app decide which rows are meal rows? → A: A per-row "Meal row" setting,
  preset from the row's name. Rows start in auto mode (follow the name, including after
  renames); once the traveler switches it, that choice sticks.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tell meal rows from activity rows at a glance (Priority: P1)

Looking at the schedule, the traveler sees meal rows (Breakfast, Lunch, Dinner, Dessert by
default) with a light food tint and a fork-and-knife icon on the row label, so food and
activity slots are easy to tell apart. It is only a visual hint: any item can still go in any
row.

**Independent Test**: Create a trip: Breakfast, Lunch, Dinner and Dessert rows show the icon
and tint; Morning and Afternoon don't.

**Acceptance Scenarios**:

1. **Given** a new trip, **Then** rows named Breakfast, Lunch, Dinner and Dessert are meal rows
   and the others are not.
2. **Given** a row in auto mode, **When** it is renamed to a meal name (e.g. "Lunch break"),
   **Then** it becomes a meal row.
3. **Given** any row, **When** the traveler chooses "Make meal row" or "Not a meal row" in its
   menu, **Then** the look changes, is saved, survives reloads and renames, and can be undone.

### Edge Cases

- Existing trips need no setup: all their rows start in auto mode.
- Placement is never restricted by the meal flag (constitution I).

## Requirements *(mandatory)*

- **FR-001**: A row is a meal row if the traveler set it so; otherwise if its name contains a
  meal word (breakfast, brunch, lunch, dinner, supper, dessert, snack(s), meal(s), tea, coffee,
  drinks, happy hour), matched as whole words.
- **FR-002**: Meal rows MUST show a fork-and-knife icon labelled "Meal row" on the row label
  (not color alone), a food-tinted label and a fainter tint on the day cells, using design
  tokens with WCAG AA text contrast in light and dark.
- **FR-003**: The row menu MUST offer "Make meal row" / "Not a meal row"; the choice is stored per
  row, synced like other row changes, and undoable.

## Success Criteria *(mandatory)*

- **SC-001**: Default meal rows are identifiable without opening any menu.
- **SC-002**: Switching a row takes 2 actions (open menu, choose).

## Assumptions

- Stored as a nullable `blocks.is_meal` column (null = auto); no backfill.
- No "back to auto" control in the UI; null is only the starting state.
