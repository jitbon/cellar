# Quickstart & Validation: Professional UI Redesign

Setup is unchanged from [001 quickstart](../001-block-trip-planner/quickstart.md) (local
Supabase + `pnpm --filter web dev`). Reference look: "Cellar Design Directions", option A
(https://claude.ai/artifact/JWu8yKVQD9fPnqpPfYra7U).

## Automated checks

```bash
pnpm --filter web test        # cellOverflow, no-emoji, token count, token contrast, components
pnpm --filter web e2e         # all 001/002 scenarios + layout.spec + drag.spec + a11y (light & dark)
pnpm --filter @cellar/core test && pnpm test:db   # unchanged, must still pass
pnpm lint                     # tokens only
```

## Manual validation scenarios

Use a 5-day trip with a location, at 1440×900 unless noted.

| # | Steps | Expected | Spec |
|---|---|---|---|
| 1 | Open the trip with the item panel closed | ≥ 5 days and ≥ 8 blocks visible; navy 48 px header; no emoji anywhere | SC-001, SC-004, SC-005 |
| 2 | Hover an empty cell, then click it | Quiet until hover; "Add" appears; click starts typing | FR-005 |
| 3 | Add 1, 2, 3, then 5 events to one cell | Columns never change width; row grows to 1, 2, 3 lines; at 5 shows 2 chips + "+3 more" | FR-004, US1-7/8 |
| 4 | Click "+3 more" | Popover lists all 5; reorder one; drag one out to another cell | US1-7 |
| 5 | Hover a chip; open its "⋯" menu | Switch type / Move / Edit / Remove; Edit opens the small form | FR-003 |
| 6 | Give an event a 60-character name | Chip truncates with ellipsis; tooltip shows full name | edge cases |
| 7 | Drag a chip from Day 1 Lunch to Day 4 Dinner | Lifted chip with shadow follows the pointer the whole way; target highlights with insertion line; drop animates | US3, SC-003 |
| 8 | Start a drag, press Escape | Chip returns to origin | US3-4 |
| 9 | Drag a chip to the right edge of the grid | Grid auto-scrolls | US3-3 |
| 10 | Turn on OS "Reduce motion", drag again | No tilt/scale/drop animation; chip still follows pointer | FR-011 |
| 11 | Keyboard: focus a chip's "Drag" handle, Space, arrows, Space | Chip moves; target announced | US3-6 |
| 12 | Set Day 1 arrival to Lunch and Day 3 location to Osaka via day menus | Small plane / pin indicators under those dates only; headers ≤ 2 lines | US2 |
| 13 | Toggle "Items" in the header | Panel slides in/out; grid widens when closed; state remembered after reload | US4 |
| 14 | In the panel: search "ram", filter Food, click Add | Filters work; Add opens a compact form and closes after adding | US4 |
| 15 | Drag from the panel into a cell | Same floating chip; panel item stays | US3, 001 FR-012 |
| 16 | Visit Sign in, Trips, Settings | Same type scale, icons, buttons, navy accent; trips as itinerary rows | US5 |
| 17 | Switch OS to dark mode | Every screen has a matching dark theme, readable | edge cases |
| 18 | 360 px phone width | One day at a time; labels on one line; long-press to drag shows floating chip; panel is a bottom sheet | edge cases |
| 19 | Side-by-side with the old design (`main` before 003) | Primary user prefers the new design | SC-008 |
