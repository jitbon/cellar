# Research: Professional UI Redesign

Decisions for [plan.md](./plan.md). Platform was settled in the spec (web, Q1). Core, data, and
Supabase are unchanged; everything here is in `apps/web`.

## R1. Platform and framework

- **Decision**: Keep React 19 + Vite + CSS Modules + design tokens. No rewrite, no CSS framework,
  no styled component library.
- **Rationale**: The current look comes from specific choices (always-visible card controls,
  tall headers, emoji, a soft token set), not from React. Professional web planners (Linear,
  Notion, Google Calendar, airline sites) use the same stack class. CSS Modules + tokens already
  enforce consistency through stylelint; replacing them would touch every file for no gain.
- **Alternatives considered**: Native iOS/Swift (rejected in spec Q1: drops web, can't reuse the
  TypeScript core); Tailwind (a second styling system alongside tokens); MUI/Chakra (opinionated
  looks that fight the Airline direction and add weight).

## R2. Design tokens (Airline direction, constitution v1.1.0 Principle II)

- **Decision**: Replace `apps/web/src/styles/tokens.css` with a new set; names stay semantic so
  most components keep compiling:
  - **Color (light)**: `--color-bg #ffffff`, `--color-surface #f3f5f9`, `--color-border #e4e8ef`,
    `--color-border-strong #c9d1de`, `--color-text #0d1b2e`, `--color-text-muted #5a6880`,
    `--color-accent #0b2d63` (navy), `--color-accent-soft #e7eef9`, `--color-on-accent #ffffff`,
    `--color-activity #0b2d63` / `--color-activity-bg #edf2fa`, `--color-food #9a5b00` /
    `--color-food-bg #fbf1e1`, `--color-header-bg #0b2d63`, `--color-header-text #ffffff`,
    `--color-header-muted #b9c8e4`, `--color-greyed-hatch` (diagonal hatch), `--color-danger`,
    `--color-focus #1d6ff2`. Dark set: navy-black surfaces (`#0e1520`, `#151e2c`), light text,
    accent `#8fb3ff`, same roles. All pairs checked for WCAG AA in tests (R13).
  - **Type scale (5 sizes)**: `--font-size-xs 11px` (uppercase labels), `--font-size-sm 12px`
    (meta, chips), `--font-size-md 13px` (body), `--font-size-lg 15px` (dialog titles),
    `--font-size-xl 20px` (page titles). Weights 400/500/600/700. Uppercase labels get
    `letter-spacing: .06em`.
  - **Spacing**: `--space-1 2px, -2 4px, -3 6px, -4 8px, -5 12px, -6 16px, -7 24px, -8 32px`.
  - **Radius**: `--radius-xs 3px` (chips), `--radius-sm 4px` (inputs, buttons),
    `--radius-md 6px` (popovers, panels), `--radius-pill`.
  - **Elevation**: `--shadow-1` (menus), `--shadow-2` (dialogs), `--shadow-drag`
    (`0 10px 24px -6px rgb(15 23 42 / 35%), 0 2px 6px rgb(15 23 42 / 15%)`).
  - **Sizes**: `--size-chip 24px`, `--size-row-min 36px`, `--size-header 48px`,
    `--size-block-label 112px`, `--size-day-column 168px`, `--size-panel 248px`,
    `--size-icon 14px`, `--size-icon-button 24px`, `--size-touch 44px` (touch targets via
    padding/hit-area on coarse pointers).
- **Rationale**: Matches the approved mockup (option A); ≤5 text sizes (SC-005); stylelint
  `declaration-strict-value` already forces tokens.
- **Alternatives considered**: Keeping 8 px radii — reads soft, against the amended principle.

## R3. Typeface

- **Decision**: Public Sans (variable), self-hosted via `@fontsource-variable/public-sans`,
  with fallback `system-ui, -apple-system, "Segoe UI", sans-serif`. `font-variant-numeric:
  tabular-nums` on dates and counts.
- **Rationale**: Neutral, government/transport heritage (fits Airline), wide weight range, SIL
  OFL. Self-hosting avoids a runtime request to Google (no third-party call, works offline-ish).

## R4. Icons

- **Decision**: `lucide-react` (ISC), imported per icon (tree-shaken), rendered at
  `--size-icon` (14 px) with 1.75 stroke. Replaces every emoji in UI (📅 📍 🎟 🕒 ✈ …) and the
  002 inline weather SVGs (`Sun`, `CloudSun`, `Cloud`, `CloudFog`, `CloudRain`, `CloudSnow`,
  `CloudLightning`). Travel: `PlaneLanding` / `PlaneTakeoff`; location `MapPin`; activity
  `Flag`; food `Utensils`; menus `MoreHorizontal`; drag `GripVertical`.
- **Rationale**: One consistent stroke set (FR-013, SC-005); covers every glyph needed.
- **Alternatives considered**: Keep hand-drawn SVGs (inconsistent, more to maintain); Heroicons
  (no plane/weather coverage).

## R5. Menus, tooltips, and popovers

- **Decision**: Add `@radix-ui/react-dropdown-menu` and `@radix-ui/react-tooltip` (unstyled,
  styled with our tokens) for: day menu, block menu, chip actions menu, trip "⋯" menu, and
  truncation tooltips. Keep the existing `Dialog` and `Popover` (002) for forms.
- **Rationale**: Hiding actions behind menus (FR-003, FR-006, FR-008) must stay keyboard- and
  screen-reader-accessible (constitution II, WCAG AA): roving focus, typeahead, Escape, focus
  return, collision-aware positioning. Hand-rolling that for five menus is more code and risk
  than two small headless packages.
- **Alternatives considered**: Hand-written menus (a11y edge cases); full Radix Themes (styled,
  conflicts with tokens).

## R6. Grid layout and stable columns

- **Decision**: Keep the CSS grid, with fixed track widths:
  `grid-template-columns: var(--size-block-label) repeat(var(--day-count), minmax(var(--size-day-column), 1fr))`
  and every cell `min-width: 0` so chip text truncates instead of widening a track. Sticky
  header row (`top`) and sticky block-label column (`left`). Rows size to content (`auto`),
  which is bounded by R7. Phone (< 640 px): label column + one day, day switcher in the header
  (existing behavior, restyled).
- **Rationale**: FR-004 (no column width changes), FR-007 (at 1440 px: 112 + 5×168 = 952 px plus
  a 248 px panel fits; closed panel fits 7 days).

## R7. Cell overflow (spec Q2: grow to 3, then "+N more")

- **Decision**: A pure function `visibleChips(count) → { shown: number; more: number }`
  (`count ≤ 3` → all; `count ≥ 4` → `{ shown: 2, more: count − 2 }`) in
  `apps/web/src/lib/cellOverflow.ts`, unit-tested. "+N more" is a button that opens a
  `CellListPopover` showing all chips as a sortable dnd-kit list (editable, reorderable, valid
  drop target; FR-004). While a drag hovers a collapsed cell, the drop inserts at the end.
- **Rationale**: Deterministic row heights: 1–3 chip lines, never more (US1-8).

## R8. Chips (placements)

- **Decision**: `PlacementChip` replaces `PlacementCard`: one 24 px line — type icon (14 px),
  name (ellipsis; full name in a Tooltip and in `aria-label`), and on hover/focus-within a
  `MoreHorizontal` button opening a DropdownMenu: "Switch to Food place/Activity", "Move to…",
  "Edit…", "Remove". The whole chip is the drag handle (dnd-kit `PointerSensor` distance 5 px so
  clicks still work; `TouchSensor` long-press 200 ms kept); a visually hidden "Drag <name>"
  button stays for keyboard drag and existing tests. Click (no drag) opens the edit popover.
- **Rationale**: FR-003; actions keep their existing accessible names so the 001/002 e2e suite
  needs only selector updates where a menu must be opened first.

## R9. Drag that feels free (US3)

- **Decision**: dnd-kit `DragOverlay` rendered in a portal: the overlay is a `PlacementChip`
  styled `--shadow-drag`, `scale(1.04) rotate(-1.5deg)`, `cursor: grabbing`, `z-index` above the
  panel. Origin chip shows as a dashed placeholder (opacity .5). Target cell gets
  `--color-accent-soft` fill + 1.5 px accent inset ring and an insertion line between chips
  (sortable strategy). `autoScroll` enabled on the grid scroller with edge threshold 10%.
  `dropAnimation` 180 ms ease-out; with `prefers-reduced-motion: reduce` → no rotate/scale,
  `dropAnimation: null`. Escape cancels (dnd-kit default). List-panel items use the same overlay.
  Keyboard sensor unchanged with existing announcements.
- **Rationale**: FR-010/011, SC-003; DragOverlay moves a single absolutely-positioned element
  via `transform`, so it tracks at 60 fps without re-laying out the grid.
- **Alternatives considered**: Moving the real element (current; causes layout shifts and can't
  float over the panel); native HTML5 DnD (no touch, ghost image can't be styled).

## R10. Headers

- **Decision**:
  - **Trip header**: one 48 px navy bar — back chevron, trip name (15 px/700), date range
    (`CalendarDays` + "Oct 15 – 19 · 5 days", opens the existing date picker), location
    (`MapPin` + name, opens `LocationDialog`), spacer, Undo/Redo icon buttons with tooltips,
    "Items" toggle (panel), "⋯" menu (trip settings, rename, delete).
  - **Tips**: a new `Toast` (bottom-center, auto-dismiss 8 s, "Got it" button, remembered per
    device) replaces the full-width info `Banner`. Warning banners (save failed, weather
    unavailable) become a slim 32 px strip under the header.
  - **Day header**: "THU" (11 px uppercase) + "Oct 15" (12 px tabular) on one line, a "⋯" day
    menu button on hover/focus (always visible on touch). Indicators line (only when set):
    `PlaneLanding Arrive · Lunch`, `PlaneTakeoff Depart · Afternoon`, `MapPin Osaka`, each a
    button opening the day menu. Day menu: "Arrival…", "Departure…", "Location…", "Use trip
    location", "Clear travel".
- **Rationale**: FR-008/009, SC-004.

## R11. Item panel

- **Decision**: `ItemPanel` — right-side panel (`--size-panel`), collapsible from the header
  "Items" toggle; on < 640 px a bottom sheet (existing "Show list" behavior, restyled). Contents:
  title + "Add" button (opens a `Popover` form), search field (filters by name, case- and
  accent-insensitive), segmented control All / Activities / Food, a "Not yet placed" toggle, and
  a compact chip list with "placed N×" counts. Open state in `localStorage`
  (`cellar:itemPanelOpen`, try/catch).
- **Rationale**: FR-012, SC-001 (frees width).

## R12. Other screens

- **Decision**: Restyle Sign in / Sign up / Reset password as a centered 360 px card on the
  surface color with the wordmark; Trips list as itinerary rows (name, date range, location,
  day count, chevron) with "New trip" primary button in a slim navy header; Settings as a
  single-column form with section labels. Same components (Button, TextField, Dialog) with new
  styles.
- **Rationale**: US5, FR-013.

## R13. Verification

- **Decision**:
  - Keep all 001/002 unit and e2e tests green; update only selectors that now require opening a
    menu (helpers in `apps/web/e2e/helpers.ts`, e.g. `openDayMenu`, `openChipMenu`).
  - New e2e `apps/web/e2e/layout.spec.ts` at 1440×900: ≥5 day headers and ≥8 block labels fully
    inside the viewport with the panel closed, ≥4 with it open (SC-001, FR-007); chip height
    ≤ 32 px and column widths unchanged after adding 1/2/3 events (SC-002); row heights for
    1/2/3/5 events = 1/2/3/3 lines and "+3 more" visible (US1-7/8); day header ≤ 2 lines and
    trip header ≤ one row height (SC-004); block names never wrap (`scrollHeight` check).
  - New e2e `apps/web/e2e/drag.spec.ts`: overlay element follows pointer (bounding box within
    8 px of pointer at several steps), target cell gets the highlight class, Escape returns
    the chip, reduced-motion emulation removes the transform rotate.
  - `apps/web/tests/no-emoji.test.ts`: scans `src/**/*.tsx` for emoji code points in JSX text
    (SC-005). A stylelint rule already forbids non-token font sizes; plus a unit test that
    `tokens.css` defines exactly 5 `--font-size-*` tokens.
  - `a11y.spec.ts` runs axe on every screen in light and dark (`colorScheme` emulation) (SC-007).
  - A unit test checks contrast of declared token pairs (text/bg, muted/bg, on-accent/accent,
    activity/activity-bg, food/food-bg) ≥ 4.5:1 in both themes.
- **Rationale**: Turns SC-001–SC-007 into automated checks; SC-008 is the manual side-by-side.
