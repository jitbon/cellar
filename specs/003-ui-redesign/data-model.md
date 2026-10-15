# Data Model: Professional UI Redesign

No database, core type, or sync changes. 001 and 002 data models apply unchanged.

## Per-device UI preferences (browser `localStorage`, never synced)

All reads and writes wrapped in try/catch; missing or unreadable values fall back to the
default.

| Key | Type | Default | Used by |
|---|---|---|---|
| `cellar:itemPanelOpen` | `"1"` / `"0"` | `"1"` at ≥ 1280 px wide, `"0"` below | Item panel (FR-012) |
| `cellar:tip:<tipId>` | `"dismissed"` | absent | One-time tips toast (FR-009) |

The existing 001 one-time banner state, if stored under another key, is migrated by reading it
once and writing `cellar:tip:<tipId>`.

## Derived view state (not stored)

### Cell overflow

`visibleChips(count)` (research R7):

| `count` | `shown` | `more` | Row lines |
|---|---|---|---|
| 0 | 0 | 0 | 1 (min row height) |
| 1 | 1 | 0 | 1 |
| 2 | 2 | 0 | 2 |
| 3 | 3 | 0 | 3 |
| n ≥ 4 | 2 | n − 2 | 3 ("+N more" is the 3rd line) |

A row's height is the maximum of its cells' line counts.

### Drag state

| State | Visual |
|---|---|
| idle | chips at rest |
| dragging | origin chip = dashed placeholder; `DragOverlay` chip under pointer; hovered cell highlighted with insertion line |
| dropped | overlay animates to the new slot (180 ms; none with reduced motion), placeholder removed |
| cancelled (Escape / drop outside a cell) | overlay animates back to origin |
