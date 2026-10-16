# Tasks: Header Tweaks

**Input**: [spec.md](./spec.md). Small change; no separate plan.

- [X] T001 Click-to-rename the trip name in `apps/web/src/components/layout/TripHeader.tsx` (+ css): name button → field, Enter/blur saves via `onRename` (wired to `renameTrip` in `apps/web/src/pages/TripPlanner.tsx`), Escape cancels, unchanged names do nothing, errors keep the field open; tests in `apps/web/tests/TripHeader.test.tsx` per FR-001
- [X] T002 Make the banner's city the location button (`apps/web/src/components/layout/CityBanner.tsx`, `onEditLocation`), hide the header chip while the banner shows (`showLocation` in `TripHeader.tsx`), and show city/progress before the photo arrives; tests in `apps/web/tests/CityBanner.test.tsx` and `TripHeader.test.tsx` per FR-002
- [X] T003 E2E in `apps/web/e2e/header.spec.ts`: rename in place with undo, Escape and reload; city on the banner opens the location dialog; hiding the banner brings the chip back; unlocated trip keeps "Add a location"
- [X] T004 Reject new events in greyed cells in core (`validateCell` in `packages/core/src/commands/placement.ts`, code `OUTSIDE_TRAVEL_WINDOW`; reordering within a cell and moving out stay allowed); tests in `packages/core/tests/greyed-cells.test.ts` per FR-003
- [X] T005 Greyed cells: no "+ Add" and disabled droppables (`Cell.tsx`, `CellListPopover.tsx`); "Place in a block" disables greyed blocks (`CellPickerDialog.tsx`); pointer drops use only the cell under the pointer (`DndProvider.tsx`); tests in `Cell.test.tsx`, `CellPickerDialog.test.tsx` and `apps/web/e2e/drag.spec.ts` per FR-003, FR-004
