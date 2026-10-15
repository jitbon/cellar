# Contract: Web UI (components, accessible names, tokens)

What the redesign guarantees to users and to the e2e suite. Core contracts from 001/002 are
unchanged.

## Design tokens (`apps/web/src/styles/tokens.css`)

Exactly these families, values per [research R2](../research.md):

- `--color-*` (light on `:root`; dark under `@media (prefers-color-scheme: dark)`)
- `--font-size-xs|sm|md|lg|xl` — exactly five
- `--space-1…8`, `--radius-xs|sm|md|pill`, `--shadow-1|2|drag`
- `--size-chip|row-min|header|block-label|day-column|panel|icon|icon-button|touch`
- `--font-family` = Public Sans stack

Components use tokens only (stylelint `declaration-strict-value`). No emoji in UI text.

## Components (new or replaced) in `apps/web/src/components/`

| Component | Replaces | Contract |
|---|---|---|
| `grid/PlacementChip` | `PlacementCard` | 24 px single line: type icon + truncated name; tooltip with full name; actions menu; whole chip draggable |
| `grid/CellListPopover` | — | Full sortable list for a cell with 4+ chips; drop target |
| `grid/DayHeader` | same | "THU Oct 15" one line + day menu; indicators only when set |
| `grid/BlockLabel` | same | Name only, one line, ellipsis; block menu (Rename, Time window…, Add block below, Remove) |
| `grid/DragLayer` | — | `DragOverlay` with lifted chip (research R9) |
| `layout/TripHeader` | header in `TripPlanner` | 48 px navy bar (research R10) |
| `list/ItemPanel` | `ItemList` | Collapsible panel / bottom sheet (research R11) |
| `ui/Menu` | — | Thin wrapper over Radix DropdownMenu, token-styled |
| `ui/Tooltip` | — | Thin wrapper over Radix Tooltip |
| `ui/Toast` | info `Banner` | Dismissible one-time tips |
| `ui/Icon` | emoji + inline SVGs | Re-exports the lucide icons used, sized by `--size-icon` |

## Accessible names (stable; e2e relies on them)

Kept exactly as in 001/002:

- Cell add button: `Add event to <Block> on <YYYY-MM-DD>`; typing combobox `Add event to <Block>…`
- Drag handle: `Drag <name>` (visually hidden, keyboard-operable)
- Chip actions (now menu items): `Switch <name> to Food place|Activity`, `Move <name> to another block`, `Edit <name>`, `Remove <name>`
- Block: `Rename <Block>`, `Edit time window for <Block>`, `Add block below <Block>`, `Remove <Block>`, `Reorder <Block>`
- Day: `Set arrival and departure for <date>`, `Set location for <date>`, `Use trip location on <date>`
- Trip: `Undo`, `Redo`, `Trip settings`, `Change trip dates (<range>)`, `Change trip location (<name>)` / `Add a location`, `Show list` (the panel toggle keeps this name; `aria-expanded` gives its state)
- Item list: `Drag <item>`, `Edit <item>`, `Delete <item>`, `Place <item> in a block`; region `Activities and food`
- Trips list: `Rename <trip>`, `Delete <trip>`, `Restore <trip>`
- Weather icon: `<Block> weather: <Condition>, <N>% chance of rain`

New:

- Chip actions trigger: `Actions for <name>`
- Day menu trigger: `Day options for <date>`
- Block menu trigger: `Options for <Block>`
- Overflow: `Show all <N> events in <Block> on <date>` (visible text `+<N−2> more`)
- Trip menu: `More trip actions`

Where an action moved into a menu, the menu item carries the old accessible name, so tests
open the menu (`Actions for …`, `Day options for …`, `Options for …`) and then use the same name.

## Layout guarantees (verified by `e2e/layout.spec.ts`)

| Guarantee | Spec |
|---|---|
| 1440×900, panel closed: ≥ 5 day headers and ≥ 8 block labels fully visible | FR-007, SC-001 |
| 1440×900, panel open: ≥ 4 day headers visible | FR-007 |
| Chip height ≤ 32 px; column widths unchanged after adding events | FR-004, SC-002 |
| Row lines = min(max events, 3); 4+ events show 2 chips + "+N more" | US1-7/8 |
| Day header ≤ 2 text lines; trip header height ≤ one block row | SC-004 |
| Block names never wrap | FR-006 |
